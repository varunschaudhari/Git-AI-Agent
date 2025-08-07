require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI with new v5 API
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Cache for API responses to avoid duplicate requests
const responseCache = new Map();

async function generateIssueDetails(bugDescription) {
    const cacheKey = `issue-${bugDescription.substring(0, 50)}`;
    
    // Check cache first
    if (responseCache.has(cacheKey)) {
        console.log('Using cached response');
        return responseCache.get(cacheKey);
    }

    const prompt = `Generate a structured GitHub issue with these sections:
    - Issue Title: [concise and descriptive title]
    - Description: [detailed description of the issue]
    - Steps to Reproduce: [if applicable]
    - Expected Behavior: [what should happen]
    - Actual Behavior: [what currently happens]
    - Possible Solution: [suggestions for fixing]
    - Commit Message: [suggested commit message when fixed]

    Bug/Issue Description: ${bugDescription}
    
    Format the response with clear section headers.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000,
            temperature: 0.7,
        });

        const result = response.choices[0].message.content;
        
        // Cache the response
        responseCache.set(cacheKey, result);
        
        return result;
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw error;
    }
}

async function createGitHubIssue(title, body) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
    const headers = {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        'Content-Type': 'application/json',
    };
    const data = { title, body };

    try {
        const response = await axios.post(url, data, { 
            headers,
            timeout: 30000 // 30 second timeout
        });
        return response.data;
    } catch (error) {
        console.error('GitHub API error:', error.response?.data || error.message);
        throw error;
    }
}

// Enhanced error handling
function handleError(error, context) {
    console.error(`${context} error:`, error);
    
    if (error.response) {
        const status = error.response.status;
        if (status === 401) {
            console.error("Authentication failed. Please check your API keys.");
        } else if (status === 403) {
            console.error("Access forbidden. Check your repository permissions.");
        } else if (status === 429) {
            console.error("Rate limit exceeded. Please try again later.");
        }
    }
}

(async () => {
    try {
        console.log('Starting GitHub Issue Creator...');
        
        // Validate environment variables
        if (!GITHUB_TOKEN || !GITHUB_REPO || !OPENAI_API_KEY) {
            throw new Error('Missing required environment variables. Please check GITHUB_TOKEN, GITHUB_REPO, and OPENAI_API_KEY.');
        }

        // Remove the artificial delay for better performance
        // await new Promise(resolve => setTimeout(resolve, 5000)); // Removed 5 sec delay

        const bugDescription = "BUILD AI AGENT WHICH WILL CREATE ISSUE IN GITHUB AUTOMATICALLY BASED ON PROMPT WRITTEN";
        console.log('Generating issue details...');
        
        const issueContent = await generateIssueDetails(bugDescription);

        // Enhanced parsing to extract title more reliably
        const issueLines = issueContent.split("\n");
        let title = "Auto-generated Issue";
        let body = issueContent;
        
        // Look for title in various formats
        const titleLine = issueLines.find(line => 
            line.toLowerCase().includes('title:') || 
            line.toLowerCase().includes('issue title:')
        );
        
        if (titleLine) {
            title = titleLine.replace(/.*title:\s*/i, '').trim();
            // Remove the title line from body
            body = issueLines.filter(line => line !== titleLine).join("\n").trim();
        } else if (issueLines[0] && issueLines[0].trim()) {
            // Use first non-empty line as title
            title = issueLines[0].replace(/^[^\w]*/, '').trim();
            body = issueLines.slice(1).join("\n").trim();
        }

        console.log('Creating GitHub issue...');
        const issueResponse = await createGitHubIssue(title, body);
        console.log(`✅ Issue Created Successfully: ${issueResponse.html_url}`);
        console.log(`Issue Number: #${issueResponse.number}`);
        
    } catch (error) {
        handleError(error, 'Application');
        process.exit(1);
    }
})();
