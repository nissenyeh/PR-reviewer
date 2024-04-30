
const core = require('@actions/core');
const axios = require('axios');

const {
  getPullRequestsToReview,
  getPullRequestsWithoutLabel,
  getPullRequestsReviewersCount,
  createPr2UserArray,
  checkGithubProviderFormat,
  prettyMessage,
  stringToObject,
  getTeamsMentions,
  formatSlackMessage,
  formatRocketMessage,
  formatTeamsMessage,
} = require('./functions');


// fix: GITHUB_TOKEN 拿不到
const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL } = process.env;

const AUTH_HEADER = {
  Authorization: `token ${GITHUB_TOKEN}`,
};
const PULLS_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;


/**
 * Get Pull Requests from GitHub repository
 * @return {Promise} Axios promise
 */
async function getPullRequests() {
  return axios({
    method: 'GET',
    url: PULLS_ENDPOINT,
    headers: AUTH_HEADER,
  });
}

function getDateXDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0]; // 返回格式為 YYYY-MM-DD
}

const SEARCH_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;

async function getOldPullRequests(days) {

  const query = `repo:${GITHUB_REPOSITORY} is:pr is:open created:<${getDateXDaysAgo(days)}`;
  return axios({
    method: 'GET',
    url: SEARCH_ENDPOINT,
    headers: AUTH_HEADER,
    params: {
      q: query
    }
  });
}


// call open AI

async function getOpenAI(code) {
  var data = JSON.stringify(
    {"data":{
      "messages":[
        {"role":"system",
        "content":`請幫我分析這段程式碼，並且大概描述內容，並且推薦適合 Reviwer 的人 ${code}`},
        {"role":"user","content":"hello"}],
        "max_tokens":512,
        "temperature":0.9,
        "model":"gpt-3.5-turbo",
        "stream":false
      }
    });
  
  var config = {
    method: 'post',
    url: 'https://ci-live-feat-video-ai-dot-junyiacademy.appspot.com/api/v2/jutor/hf-chat',
    headers: { 
      'x-api-key': 'b4c318b8d6f770e10163436e0e868b806f50f34ae57f378e78956fb76b41fd27', 
      'Content-Type': 'application/json', 
      'Cookie': 'fkey=1.0_hWjFLoxRNhhpww%3D%3D_1714508852'
    },
    data : data
  };
  return axios(config);
}


axios(config)
.then(function (response) {
  console.log(JSON.stringify(response.data));
})
.catch(function (error) {
  console.log(error);
});



/**
 * Main function for the GitHub Action
 */
async function main() {
  try {
    // 獲取開啟一段時間的 PR 
    core.info('Starting...');
    core.info('Getting open pull requests...');
    const openTime = core.getInput('open-time');
    core.info('openTime...');
    core.info(openTime);
    const pullRequests = await getOldPullRequests(openTime);
    for (const pr of pullRequests.data) {
      core.info(`Pull Request Title: ${pr.title}`);
      const diff = pr.diff_url
      core.info(diff);



    }

    // 看差異
  } catch (error) {
    core.info(error);
    core.setFailed(error);
  }
}

main();
