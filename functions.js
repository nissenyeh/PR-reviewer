/**
 * Filter Pull Requests with requested reviewers only
 * @param {Array} pullRequests Pull Requests to filter
 * @return {Array} Pull Requests to review
 */
function getPullRequestsToReview(pullRequests) {
  return pullRequests.filter((pr) => pr.requested_reviewers.length || pr.requested_teams.length);
}

/**
 * Filter Pull Requests without a specific label
 * @param {Array} pullRequests Pull Requests to filter
 * @param {String} ignoreLabels Pull Request label(s) to ignore
 * @return {Array} Pull Requests without a specific label
 */
function getPullRequestsWithoutLabel(pullRequests, ignoreLabels) {
  const ignoreLabelsArray = ignoreLabels.replace(/\s*,\s*/g, ',').split(','); // ['ignore1', 'ignore2', ...]
  const ignoreLabelsSet = new Set(ignoreLabelsArray);
  return pullRequests.filter((pr) => !((pr.labels || []).some((label) => ignoreLabelsSet.has(label.name))));
}

/**
 * Count Pull Requests reviewers
 * @param {Array} pullRequests Pull Requests
 * @return {Number} Reviewers number
 */
function getPullRequestsReviewersCount(pullRequests) {
  return pullRequests.reduce((total, pullRequest) => (total + pullRequest.requested_reviewers.length), 0);
}

/**
 * Create an Array of Objects with { url, title, login } properties from a list of Pull Requests
 * @param {Array} pullRequestsToReview Pull Requests
 * @return {Array} Array of Objects with { url, title, login } properties
 */
function createPr2UserArray(pullRequestsToReview) {
  const pr2user = [];
  for (const pr of pullRequestsToReview) {
    for (const user of pr.requested_reviewers) {
      pr2user.push({
        url: pr.html_url,
        title: pr.title,
        login: user.login,
      });
    }
    for (const team of pr.requested_teams) {
      pr2user.push({
        url: pr.html_url,
        title: pr.title,
        login: team.slug,
      });
    }
  }
  return pr2user;
}

/**
 * Check if the github-provider-map string is in correct format
 * @param {String} str String to be checked to be in correct format
 * @return {Boolean} String validity as boolean
 */
function checkGithubProviderFormat(str) {
  // Pattern made with the help of ChatGPT
  const az09 = '[A-z0-9_\\-@\\.]+';
  const pattern = new RegExp(`^${az09}:${az09}(,\\s*${az09}:${az09})*$`, 'm');
  return pattern.test(str);
}

/**
 * Convert a string like "name1:ID123,name2:ID456" to an Object { name1: "ID123", name2: "ID456"}
 * @param {String} str String to convert to Object
 * @return {Object} Object with usernames as properties and IDs as values
 */
function stringToObject(str) {
  const map = {};
  if (!str) {
    return map;
  }
  const users = str.replace(/[\s\r\n]+/g, '').split(',');
  users.forEach((user) => {
    const [github, provider] = user.split(':');
    map[github] = provider;
  });
  return map;
}


/**
 * Formats channel and slack message text into a request object
 * @param {String} channel channel to send the message to
 * @param {String} message slack message text
 * @return {Object} Slack message data object
 */
function formatSlackMessage(channel, blocks) {
  const messageData = {
    channel: channel,
    username: 'Pull Request reviews reminder',
    text: '測試訊息',
    blocks: blocks
  };
  return messageData;
}

/**
 * Format the MS Teams message request object
 * Docs: https://bit.ly/3UlOoqo
 * @param {String} message formatted message string
 * @param {Array} [mentionsArray] teams mention objects array
 * @return {Object} Ms Teams message data object
 */
function formatTeamsMessage(message, mentionsArray = []) {
  const messageData = {
    type: `message`,
    attachments: [
      {
        contentType: `application/vnd.microsoft.card.adaptive`,
        content: {
          type: `AdaptiveCard`,
          body: [
            {
              type: `TextBlock`,
              text: message,
              wrap: true,
            },
          ],
          $schema: `http://adaptivecards.io/schemas/adaptive-card.json`,
          version: `1.0`,
          msteams: {
            width: 'Full',
            entities: mentionsArray,
          },
        },
      },
    ],
  };

  return messageData;
}

function getDateHoursAgo(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString().split('T')[0]; // 返回格式為 YYYY-MM-DD
}




function generateSlackRichTextBlock(messageContents){

  let elements = []

  messageContents.map(block => {
    Object.entries(block).forEach(([key, value]) => {
      const slack_block = generateSlackElement(key,value)
      elements.push(slack_block);
    });
  });

  slackText = {
    "type": "rich_text",
    "elements": [
      {
        "type": "rich_text_section",
        "elements": elements
      }
    ]
  }
  return slackText
}

function generateSlackTitleBlock(title){
  slackText = {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": title,
      "emoji": true
    }
  }
  return slackText
}



// 6/3 ~ 6/7 

const core = require('@actions/core');
/**
 * 計算時間差異
 * @param {String} time 時間
 * @return {Object} 包含小時和天數的物件
 */
function calculateTmeDifference(time){
  const timeDate = new Date(time);
  const currentDate = new Date(); 
  const timeDiff = Math.abs(currentDate - timeDate);
  const hours = Math.floor((timeDiff / (1000 * 60 * 60)));
  const days = Math.floor(hours / 24);
  return { hours, days };
}

function generateSlackElement(type, value) {
  if (type === 'boldText') {
    return {
      "type": "text",
      "text": value,
      "style": {
        "bold": true
      }
    }
  } else if (type === 'text') {
    return {
      "type": "text",
      "text": value,
    }
  } else if (type === 'uelText') {
    return {
      "type": "link",
      "text": value['text'],
      "url": value['url']
    }
  }
}


function formatSlackMessageBlock(messageTitle, messageContents) {

  const titleBlocks = generateSlackTitleBlock(messageTitle)
  const textBlocks = generateSlackRichTextBlock(messageContents)

  let slackBlocks = [
    titleBlocks,
    textBlocks
  ]

  return slackBlocks;
}

module.exports = {
  getPullRequestsToReview,
  getPullRequestsWithoutLabel,
  getPullRequestsReviewersCount,
  createPr2UserArray,
  checkGithubProviderFormat,
  stringToObject,
  formatTeamsMessage,
  formatSlackMessage,
  calculateTmeDifference,
  formatSlackMessageBlock,
  getDateHoursAgo
};
