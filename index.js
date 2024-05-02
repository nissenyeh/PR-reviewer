
const core = require('@actions/core');
import {execAsync} from './exec-async'
import parseGitDiff from 'parse-git-diff'
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

async function getPullRequest(pull_number) {

  const endpoint = SEARCH_ENDPOINT + '/' + pull_number
  return axios({
    method: 'GET',
    url: endpoint,
    headers: AUTH_HEADER,
  });
}
 

// call open AI

async function getOpenAI(prompt) {
  var data = JSON.stringify({
    "data": {
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

async function getDiffContent(diffUrl) {
  try {
    return await axios({
      method: 'GET',
      url: diffUrl,
      headers: AUTH_HEADER
    });
  } catch (error) {
    console.error('Error fetching diff content:', error);
    return null;
  }
}


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
      core.info(`Pull Request Body: ${pr.body}`);
    

      const prompt = `請幫我根據這以下Github Pull Request 的標題與內容
      標題：${pr.title} 內容：${pr.body}
      1. 簡單介紹 PR 內容
      2. 推薦可能適合審核的工程師（會感興趣的人）
      `

      core.info(`prompt: ${prompt}`);

      const ai_response = getOpenAI(prompt)
      core.info(JSON.stringify(ai_response));
      // core.info(`${ai_response.data.data.choices.message.content}`)
    }

    // 看差異
  } catch (error) {
    core.info(error);
    core.setFailed(error);
  }
}

main();

