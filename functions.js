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
 * Create a pretty message to print
 * @param {Array} pr2user Array of Object with these properties { url, title, login }
 * @param {Object} github2provider Object containing usernames as properties and IDs as values
 * @param {String} provider Service to use: slack or msteams
 * @return {String} Pretty message to print
 */
function prettyMessage(pr2user, github2provider, provider) {
  let message = '';
  for (const obj of pr2user) {
    switch (provider) {
      case 'slack': {
        const mention = github2provider[obj.login] ?
          `<@${github2provider[obj.login]}>` :
          `@${obj.login}`;
        message += `Hey ${mention}, the PR "${obj.title}" is waiting for your review: ${obj.url}\n`;
        break;
      }
      case 'rocket': {
        const mention = github2provider[obj.login] ?
                `<@${github2provider[obj.login]}>` :
                `@${obj.login}`;
        message += `Hey ${mention}, the PR "${obj.title}" is waiting for your review: ${obj.url}\n`;
        break;
      }
      case 'msteams': {
        const mention = github2provider[obj.login] ?
          `<at>${obj.login}</at>` :
          `@${obj.login}`;
        message += `Hey ${mention}, the PR "${obj.title}" is waiting for your review: [${obj.url}](${obj.url})  \n`;
        break;
      }
    }
  }
  return message;
}

/**
 * Create an array of MS teams mention objects for users requested in a review
 * Docs: https://bit.ly/3UlOoqo
 * @param {Object} github2provider Object containing usernames as properties and IDs as values
 * @param {Array} pr2user Array of Object with these properties { url, title, login }
 * @return {Array} MS teams mention objects
 */
function getTeamsMentions(github2provider, pr2user) {
  const mentions = [];
  // Add mentions array only if the map is provided, or no notification is sent
  if (Object.keys(github2provider).length > 0) {
    for (const user of pr2user) {
      // mentioed property needs id and name, or no notification is sent
      if (github2provider[user.login]) {
        mentions.push({
          type: `mention`,
          text: `<at>${user.login}</at>`,
          mentioned: {
            id: github2provider[user.login],
            name: user.login,
          },
        });
      }
    }
  }
  return mentions;
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
 * Formats channel and rocket message text into a request object
 * @param {String} channel channel to send the message to
 * @param {String} message rocket message text
 * @return {Object} rocket message data object
 */
function formatRocketMessage(channel, message, block) {
  const messageData = {
    channel: channel,
    username: 'Pull Request reviews reminder',
    text: message,
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


function generateSlackText(title,text){
  slackText = {
    "type": "rich_text",
    "elements": [
      {
        "type": "rich_text_section",
        "elements": [
          {
            "type": "text",
            "text": title,
            "style": {
              "bold": true
            }
          },
          {
            "type": "text",
            "text": text
          }
        ]
      }
    ]
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
  core.info(timeDate);
  core.info(currentDate);
  core.info(hours);
  core.info(days);
  return { hours, days };
}

function formatSlackMessageBlock(pr, hoursOpen, daysOpenMessage, lastUpdatedHoursAgo, lastUpdatedDaysMessage, ai_suggestion) {
  const prTitle = pr.title
  const prAuthor = pr.user.login
  const prLink = pr.html_url;

  const messageTitle = '【PR 巡邏小警察】'

  const title1 =  `▌PR title (Author) : \n`
  const text1 =  `${prTitle}  (Create by @${prAuthor})`

  const title2 =  `▌總計存活時間: \n`
  const text2 =  `已經存活 ${hoursOpen} 小時${daysOpenMessage}`

  const title3 =  `▌上次更新時間: \n`
  const text3 =  `已經是 ${lastUpdatedHoursAgo} 小時${lastUpdatedDaysMessage}以前`

  const title4 =  `▌AI 小警察介紹:\n`
  const text4 = ai_suggestion

  const slack_block =  [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": messageTitle,
          "emoji": true
        }
      },
      generateSlackText(title1,text1),
      generateSlackText(title2,text2),
      generateSlackText(title3,text3),     
      generateSlackText(title4,text4),           
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "emoji": true,
              "text": "查看 PR 詳細內容"
            },
            "style": "primary",
            "url": prLink
          }
        ]
      }
  ];

  return slack_block;
}

module.exports = {
  getPullRequestsToReview,
  getPullRequestsWithoutLabel,
  getPullRequestsReviewersCount,
  createPr2UserArray,
  checkGithubProviderFormat,
  stringToObject,
  prettyMessage,
  getTeamsMentions,
  formatTeamsMessage,
  formatRocketMessage,
  formatSlackMessage,
  calculateTmeDifference,
  formatSlackMessageBlock,
  getDateHoursAgo
};
