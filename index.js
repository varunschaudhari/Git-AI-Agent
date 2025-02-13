require('dotenv').config();
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAIApi(
    new Configuration({ apiKey: OPENAI_API_KEY })
);

async function generateIssueDetails(bugDescription) {
    const prompt = `
    Given the following bug description, generate a structured GitHub issue with:
    - Issue Title
    - Description
    - Steps to Solve
    - Expected Behavior
    - Actual Behavior
    - Possible Fix
    - Commit Message

    Bug Description: ${bugDescription}
    `;

    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
    });

    return response.data.choices[0].message.content;
}

async function createGitHubIssue(title, body) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
    const headers = {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
    };
    const data = { title, body };

    const response = await axios.post(url, data, { headers });
    return response.data;
}

(async () => {

    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 sec delay

    const bugDescription = "WANT TO BUILD AI AGENT WHICH WILL CREATE ISSUE IN GITHUB AUTOMATICALLY BASED ON PROMPT WRITTEN";
    const issueContent = await generateIssueDetails(bugDescription);

    const issueLines = issueContent.split("\n");
    const title = issueLines[0].replace("Title: ", "").trim();
    const body = issueLines.slice(1).join("\n");

    const issueResponse = await createGitHubIssue(title, body);
    console.log(`Issue Created: ${issueResponse.html_url}`);
})();
