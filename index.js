require('dotenv').config();
const axios = require('axios');

const {
  GITHUB_USERNAME,
  GITHUB_TOKEN,
  GITHUB_CONTRIBUTORS,
  REPO_OWNER,
  REPO_NAME,
} = process.env;

const users = GITHUB_CONTRIBUTORS.split(',');


// Set output file name
const OUTPUT_FILE = 'pull_requests.csv';

// Function to fetch Pull Request data
async function fetchPullRequests() {
  let pullRequests = [];

  for (const user of users) {
    let page = 1;
    let response;
    do {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all&page=${page}&per_page=100`;

      try {
        response = await axios.get(url, {
          auth: {
            username: GITHUB_USERNAME,
            password: GITHUB_TOKEN,
          },
        });

        console.log('Fetching data...')

        const prs = response.data.filter(pr => pr.user.login === user).map(async pr => {
          const [commitsResponse, reviewCommentsResponse, commentsResponse] = await axios.all([
            axios.get(pr.commits_url, { auth: { username: GITHUB_USERNAME, password: GITHUB_TOKEN } }),
            axios.get(pr.review_comments_url, { auth: { username: GITHUB_USERNAME, password: GITHUB_TOKEN } }),
            axios.get(pr.comments_url, { auth: { username: GITHUB_USERNAME, password: GITHUB_TOKEN } })
          ]);

          return {
            number: pr.number,
            title: pr.title,
            user: pr.user.login,
            createdAt: pr.created_at,
            state: pr.state,
            commitCount: commitsResponse.data.length,
            codeCommentCount: reviewCommentsResponse.data.length,
            // TODO: Make function that only count the QA comments
            normalCommentCount: commentsResponse.data.length,
            url: pr.html_url
          };
        });

        pullRequests = pullRequests.concat(await Promise.all(prs));
        page++;
      } catch (error) {
        console.error(`Failed to fetch Pull Requests for ${user}. Error: ${error.message}`);
        break;
      }
    } while (response.headers.link && response.headers.link.includes('rel="next"'));
  }

  console.log('Prepare to export to csv.')

  return pullRequests;
}

// Function to export Pull Request data as CSV
function exportToCSV(pullRequests) {
  let csvContent = 'Number,Title,User,Commits,Code Comments, Normal Comments,URL\n';

  console.log('Starting to export to csv file.')

  for (const pr of pullRequests) {
    const row = [
      pr.number,
      pr.title,
      pr.user,
      pr.commitCount,
      pr.codeCommentCount,
      pr.normalCommentCount,
      pr.url
    ].map(field => `"${field}"`).join(',');

    csvContent += `${row}\n`;
  }

  // Export to file (Node.js)
  const fs = require('fs');
  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');

  console.log(`Pull Request data exported to ${OUTPUT_FILE}`);

}

// Run the script
fetchPullRequests()
  .then(pullRequests => exportToCSV(pullRequests))
  .catch(error => console.error('Error:', error));
