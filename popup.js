document.addEventListener("DOMContentLoaded", () => {
    const setupContainer = document.getElementById("setupContainer");
    const issueContainer = document.getElementById("issueContainer");
    const repoInput = document.getElementById("repo");
    const apiKeyInput = document.getElementById("apiKey");
    const openaiKeyInput = document.getElementById("openaiKey");
    const saveSettingsBtn = document.getElementById("saveSettings");
    const issueTemplate = document.getElementById("issueTemplate");
    const priority = document.getElementById("priority");
    const description = document.getElementById("description");
    const createIssueBtn = document.getElementById("createIssue");
    const updateSettingsBtn = document.getElementById("updateSettings");

    function loadSettings() {
        const storedRepo = localStorage.getItem("githubRepo");
        const storedApiKey = localStorage.getItem("githubApiKey");
        const storedOpenAiKey = localStorage.getItem("openaiApiKey");
        
        if (storedRepo && storedApiKey && storedOpenAiKey) {
            setupContainer.classList.add("hidden");
            issueContainer.classList.remove("hidden");
        } else {
            setupContainer.classList.remove("hidden");
            issueContainer.classList.add("hidden");
        }
    }

    saveSettingsBtn.addEventListener("click", () => {
        localStorage.setItem("githubRepo", repoInput.value);
        localStorage.setItem("githubApiKey", apiKeyInput.value);
        localStorage.setItem("openaiApiKey", openaiKeyInput.value);
        loadSettings();
    });

    updateSettingsBtn.addEventListener("click", () => {
        setupContainer.classList.remove("hidden");
        issueContainer.classList.add("hidden");
    });

    async function generateIssueDetails(bugDescription) {
        const openAiKey = localStorage.getItem("openaiApiKey");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: bugDescription }]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async function createGitHubIssue(title, body) {
        const repo = localStorage.getItem("githubRepo");
        const apiKey = localStorage.getItem("githubApiKey");
        const url = `https://api.github.com/repos/${repo}/issues`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `token ${apiKey}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ title, body })
        });
        const issueData = await response.json();
        
        if (issueData.html_url) {
            alert("✅ Issue Created Successfully!");
            description.value = ""; // Reset input field for new issue creation
        } else {
            alert("❌ Error creating issue. Please check your settings.");
        }
    }

    createIssueBtn.addEventListener("click", async () => {
        const bugDescription = description.value;
        if (!bugDescription.trim()) {
            alert("⚠️ Please enter a description for the issue.");
            return;
        }
        
        const issueContent = await generateIssueDetails(bugDescription);
        
        const issueLines = issueContent.split("\n");
        const title = issueLines[0].replace("Title: ", "").trim();
        const body = issueLines.slice(1).join("\n");
        
        createGitHubIssue(title, body);
    });

    loadSettings();
});
