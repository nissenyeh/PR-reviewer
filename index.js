
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


/**
 * Main function for the GitHub Action
 */
async function main() {
  try {
    core.info('Starting...');
    core.info('Getting open pull requests...');

    const openTime = core.getInput('open-time');
    core.info('openTime...');
    core.info(openTime);
    const pullRequests = await getOldPullRequests(openTime);
    core.info(pullRequests);
    // const pullRequests = await getPullRequests();
    const totalReviewers = await getPullRequestsReviewersCount(pullRequests.data);
    core.info(`There are ${pullRequests.data.length} open pull requests and ${totalReviewers} reviewers`);
    const pullRequestsToReview = getPullRequestsToReview(pullRequests.data);
    const pullRequestsWithoutLabel = getPullRequestsWithoutLabel(pullRequestsToReview, ignoreLabel);
    core.info(`There are ${pullRequestsWithoutLabel.length} pull requests waiting for reviews`);
    core.info(`Notification sent successfully!`);
  } catch (error) {
    core.info(error);
    core.setFailed(error);
  }
}

main();
