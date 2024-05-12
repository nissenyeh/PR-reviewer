
const core = require('@actions/core');
const axios = require('axios');
const { WebClient } = require('@slack/web-api')

const {
  formatSlackMessageBlock,
  formatSlackMessage,
  getDateHoursAgo,
  calculateTmeDifference,
} = require('./functions');



async function getAllOpenPullRequests() {
  const { GITHUB_API_URL, GITHUB_TOKEN } = process.env;
  const GITHUB_REPOSITORY = 'junyiacademy/junyiacademy'
  const SEARCH_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;
  const AUTH_HEADER = {
    Authorization: `token ${GITHUB_TOKEN}`,
  };
  const query = `repo:${GITHUB_REPOSITORY} is:pr is:open`;

  return axios({
    method: 'GET',
    url: SEARCH_ENDPOINT,
    headers: AUTH_HEADER,
    params: {
      q: query
    }
  });
}


async function sendNotification(slackBlocks, threadNumber = null) {
  //  notify with slack token
  if(process.env.SLACK_TOKEN){
    const client = new WebClient(process.env.SLACK_TOKEN)
    const channelID = core.getInput('SLACK_CHANNEL_ID');
    return await client.chat.postMessage({
      channel: channelID,
      thread_ts: threadNumber,
      blocks: slackBlocks
    });
  }

  // notify bt slack webhookUrl
  const slackWebhookUrl = core.getInput('SLACK_WEBHOOK_URL');
  const slackChannelName = core.getInput('SLACK_CHANNEL_NAME');
  if(slackWebhookUrl){
    const messageObject = formatSlackMessage(slackChannelName, slackBlocks);
    return axios({
      method: 'POST',
      url: slackWebhookUrl,
      data: messageData,
    });
  } 
}


async function getOpenAI(prompt, token) {
  var data = JSON.stringify({
    "messages": [
      {
        "role": "user",
        "content": prompt
      }
    ],
    "max_tokens": 512,
    "temperature": 0.9,
    "model": "gpt-3.5-turbo",
    "stream": false
  });
  var config = {
    method: 'post',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 
      'Authorization':  `Bearer ${token}`,
      'Content-Type': 'application/json', 
    },
    data : data
  };
  return axios(config);
}

/**
 * Main function for the GitHub Action
 */
async function main() {

  const PRLastUpdateTimeThreshold = core.getInput('PR-LAST-UPDATED-TIME-EXCEEDING-X-HOURS');  
  const lang = core.getInput('LANG');

  let allPullRequests=[]
  let totalPullRequestCount = 0
  let pullRequestExceedTimeCount = 0

  let pullRequestSummaries = []
  let pullRequestIntroductionsByAI = []

  try {  // Get all Pull Request 
    core.info(`▌ Start to fetch Pull request by Github API`);
    allPullRequests = await getAllOpenPullRequests();
    totalPullRequestCount = allPullRequests.data.length
  } catch (error) {
    core.info(error);
    core.error('Failed to to get Github pull requests. Please check and try again.');
  }

  const sortedPullRequests = allPullRequests.data.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)); 

  for (const [index , pr] of sortedPullRequests.entries()) {

    core.info(`===========[${index+1}/${sortedPullRequests.length}]===========`);
    core.info(`PR Title: ${pr.title}  (Create by @${pr.user.login})`);
    core.info(`PR Update time: ${pr.updated_at}`);
    core.info(`PR Create time: ${pr.created_at}`);

    const { hours: hoursOpen , days: daysOpen } = calculateTmeDifference(pr.created_at);
    const { hours: lastUpdatedHoursAgo , days: lastUpdatedDaysAgo } = calculateTmeDifference(pr.updated_at)


    // 0. Skip Pull Requests are not exceeding PRLastUpdateTimeThreshold 
    if (lastUpdatedHoursAgo <= PRLastUpdateTimeThreshold){
      continue
    }
    pullRequestExceedTimeCount += 1;


    // 1. Generate PR summary message for slack
    // ============== message example ===============
    // - New: Add Reminder Action (@Nissen) was last updated 25 hours (1 Day) ago"
    // - Modify: Reminder API(@Nissen) has not been updated for 95 hrs(3 day)
    // ========================================
    const messageReportContents = [
      {text: `${index+1}. `},
      {uelText:{
        text:  pr.title,
        url: pr.html_url
      }},
      {text: `(@${pr.user.login}) `},
      {text:` has not been updated for ${lastUpdatedHoursAgo} hrs ${lastUpdatedDaysAgo > 0 ? `(${lastUpdatedDaysAgo} day)` : ''} \n`},
    ]
    pullRequestSummaries = pullRequestSummaries.concat(messageReportContents)


    // 2. Generate PR detail (powered by AI) for slack ("SLACK_TOKEN" & "OPEN_AI_API_TOKEN" are required`)
    // ============== message example ===============
    // ▌PR title (Author) :
    // Feat: plotter 新增可拖曳 x 軸到標籤中間的折線圖(Create by @Kim716)
    // ▌Created at :
    // 2024-04-22T10:09:13Z - already created 431 hour (17 day)
    // ▌Updated at:
    // 2024-04-23T03:45:53Z - not been updated for 414 hrs (17 day)
    // ▌ PR introduction (Powered By OpenAI):
    // 1. 這個 Pull Request 的目的是在 plotter 中新增一個功能，讓使用者可以將 x 軸拖曳到標籤的中間，以便更精確地顯示折線圖的資料。
    // 2. 我推薦具有資料視覺化或前端開發經驗的工程師來檢視這個 Pull Request。對於這些背景的工程師來說，他們對於如何在圖表中實現互動性會有更深入的了解，並且能夠確保新增功能的實現是符合最佳實踐的。
    // ========================================
    try {
      if (!process.env.SLACK_TOKEN || !process.env.OPEN_AI_API_TOKEN ){
        core.info(`Skip to generate AI introduction for Pull Request due to missing "SLACK_TOKEN" & "OPEN_AI_API_TOKEN"`);
        continue
      }
      const PR_BODY = pr.body.replace(/\n/g, ' ')
      const langDict = {
        'en': 'English',
        'zh': 'Chinese' 
      }
      const prompt = `Github Pull Request content is as follows
      title：${pr.title} content：${PR_BODY}
      -----
      Please, based on the title and content above, answer in ${langDict[lang]} following the format below:
      1. Briefly introduce the content of the PR.
      2. Recommend what type of engineer should review it (what background/interests they should have).
      `
      const aiResponse = await getOpenAI(prompt, process.env.OPEN_AI_API_TOKEN)
      const aiSuggestion = aiResponse.data.choices[0].message.content
      core.info(`PR AI Suggestion:  ${aiSuggestion}`);


      const prDetailReportTitle = '【PR Patrol Report】'
      const prDetailReportContent = [
        {boldText: `▌PR title (Author) : \n`}, 
        {uelText:{
          text:  pr.title,
          url: pr.html_url
        }},
        {text: `(Create by @${pr.user.login}) \n`},
        {boldText: `▌Created at : \n`},
        {text:`${pr.created_at} - already created ${hoursOpen} hrs ${daysOpen > 0 ? `(${daysOpen} day)` : ''} \n`},
        {boldText: `▌Updated at: \n`},
        {text:`${pr.updated_at} - not been updated for ${lastUpdatedHoursAgo} hrs ${lastUpdatedDaysAgo > 0 ? ` (${lastUpdatedDaysAgo} day)` : ''} \n`},
        {boldText: `▌PR introduction (Powered by OpenAI):\n`},
        {text: aiSuggestion},
      ]
      const slackBlocks = [formatSlackMessageBlock(prDetailReportTitle, prDetailReportContent) ] 
      pullRequestIntroductionsByAI = pullRequestIntroductionsByAI.concat(slackBlocks)
    } catch (error) {
      core.error(error)
      core.error('Failed to to generate AI suggestion, Please check and try again.');
    }

  } 

  // 3. Send PR summary message to slack channel
  // ============== message example ===============
  // ▌Pull Request Statistics:
  // There are 12 PRs (out of a total of 24) that havenot been updated in the last 24 hours.They might be waiting for the next commit, a code review, or just be closed. Keep going!
  // ▌Pull Request Summary:
  // 1. New: Add Reminder Action (@Nissen) was last updated 25 hours (1 Day) ago"
  // 2. Modify: Reminder API(@Nissen) has not been updated for 95 hrs(3 day)
  // ========================================
  try {
    core.info(`▌ Start Sending "PR statistics report" to slack channel`);
    const prReportTitle = '【PR Report】'
    const prReportContents = [
      {boldText: `▌Pull Request Statistics: \n`},
      {text:`There are ${pullRequestExceedTimeCount} PRs (out of a total of ${totalPullRequestCount}) that `},
      {boldText:`have not been updated in the last ${PRLastUpdateTimeThreshold} hours. \n`},
      {text:`They are waiting for the next commit, a code review, or just be closed. Keep going! \n\n`},
      {boldText: `▌Pull Request Summary: \n`},
      ...pullRequestSummaries
    ]
    const slackBlocks = formatSlackMessageBlock(prReportTitle, prReportContents)
    await sendNotification(slackBlocks);

  } catch (error) {
    core.error(error)
    core.error('Failed to send "PR statistics report" to slack channel, Please check and try again');
  }

  // 4. PR detail (powered by AI) to slack channel ( "SLACK_TOKEN" & "OPEN_AI_API_TOKEN" are required`)
    // ============== message example ===============
    //【PR Detail】
    // Detail will be in threads
    // ============== threads message example ===============

    // ▌PR title (Author) :
    // Feat: plotter 新增可拖曳 x 軸到標籤中間的折線圖(Create by @Kim716)
    // ▌Created at :
    // 2024-04-22T10:09:13Z - already created 431 hour (17 day)
    // ▌Updated at:
    // 2024-04-23T03:45:53Z - not been updated for 414 hrs (17 day)
    // ▌ PR introduction (Powered By OpenAI):
    // 1. 這個 Pull Request 的目的是在 plotter 中新增一個功能，讓使用者可以將 x 軸拖曳到標籤的中間，以便更精確地顯示折線圖的資料。
    // 2. 我推薦具有資料視覺化或前端開發經驗的工程師來檢視這個 Pull Request。對於這些背景的工程師來說，他們對於如何在圖表中實現互動性會有更深入的了解，並且能夠確保新增功能的實現是符合最佳實踐的。
    // ========================================
  try {
    if (!process.env.SLACK_TOKEN || !process.env.OPEN_AI_API_TOKEN){
      core.info(`Skip sending "Pull Request Detail Summary" due to missing "SLACK_TOKEN" & "OPEN_AI_API_TOKEN" are required`);
      return 
    }
    core.info(`▌ Start sending "Pull Request Detail Summary" to slack channel`);

    const messageTitle = '【Pull Request Detail Summary】'
    const messageContents = [
      {text:`Pull Request Status will be added in this threads`},
    ]
    const threadBlocks = formatSlackMessageBlock(messageTitle, messageContents)
    const resNotification = await sendNotification(threadBlocks);
    const threadNumber = resNotification['ts'] // slack thread number

    core.info(`▌ Start to reply PR introductions to slack thread`);
    for (const [index, prDetailBlock] of pullRequestIntroductionsByAI.entries()) {
      await sendNotification(prDetailBlock, threadNumber);
      core.info(`A PR introduction [${index+1}/${pullRequestIntroductionsByAI.length}] is sent`);
    }
  } catch (error) {
    core.error(error)
    core.error('Failed to send "Pull Request Detail Summary" to slack channel, Please check and try again');
  }


}

main();

