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

    // Cache for API responses to avoid duplicate requests
    const responseCache = new Map();
    
    // Debounce function to limit API calls
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

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

    // Add input validation
    function validateSettings() {
        const repo = repoInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const openaiKey = openaiKeyInput.value.trim();
        
        if (!repo || !apiKey || !openaiKey) {
            alert("⚠️ All fields are required.");
            return false;
        }
        
        // Basic repo format validation
        if (!repo.includes('/') || repo.split('/').length !== 2) {
            alert("⚠️ Repository format should be 'owner/repo'.");
            return false;
        }
        
        return true;
    }

    saveSettingsBtn.addEventListener("click", () => {
        if (!validateSettings()) return;
        
        localStorage.setItem("githubRepo", repoInput.value.trim());
        localStorage.setItem("githubApiKey", apiKeyInput.value.trim());
        localStorage.setItem("openaiApiKey", openaiKeyInput.value.trim());
        loadSettings();
    });

    updateSettingsBtn.addEventListener("click", () => {
        setupContainer.classList.remove("hidden");
        issueContainer.classList.add("hidden");
    });

    // Enhanced error handling
    function handleApiError(error, context) {
        console.error(`${context} error:`, error);
        
        if (error.status === 401) {
            alert("❌ Authentication failed. Please check your API keys.");
            updateSettingsBtn.click();
        } else if (error.status === 403) {
            alert("❌ Access forbidden. Check your repository permissions.");
        } else if (error.status === 429) {
            alert("❌ Rate limit exceeded. Please try again later.");
        } else {
            alert(`❌ ${context} failed. Please try again.`);
        }
    }

    async function generateIssueDetails(bugDescription) {
        const cacheKey = `issue-${bugDescription.substring(0, 50)}`;
        
        // Check cache first
        if (responseCache.has(cacheKey)) {
            return responseCache.get(cacheKey);
        }
        
        const openAiKey = localStorage.getItem("openaiApiKey");
        
        const prompt = `Generate a structured GitHub issue with these sections:
        - Title: [concise issue title]
        - Description: [detailed description]
        - Steps to Reproduce: [if applicable]
        - Expected Behavior: [what should happen]
        - Actual Behavior: [what currently happens]
        - Possible Solution: [suggestions for fixing]
        
        Bug/Issue Description: ${bugDescription}`;

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openAiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                throw { status: response.status, message: await response.text() };
            }
            
            const data = await response.json();
            const result = data.choices[0].message.content;
            
            // Cache the response
            responseCache.set(cacheKey, result);
            
            return result;
        } catch (error) {
            handleApiError(error, "OpenAI API");
            throw error;
        }
    }

    async function createGitHubIssue(title, body) {
        const repo = localStorage.getItem("githubRepo");
        const apiKey = localStorage.getItem("githubApiKey");
        const url = `https://api.github.com/repos/${repo}/issues`;
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `token ${apiKey}`,
                    "Accept": "application/vnd.github.v3+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ title, body })
            });
            
            if (!response.ok) {
                throw { status: response.status, message: await response.text() };
            }
            
            const issueData = await response.json();
            
            if (issueData.html_url) {
                alert("✅ Issue Created Successfully!");
                description.value = ""; // Reset input field
                
                // Clear cache related to this issue
                responseCache.clear();
            } else {
                throw new Error("No URL returned from GitHub");
            }
        } catch (error) {
            handleApiError(error, "GitHub API");
            throw error;
        }
    }

    // Add loading state management
    function setLoading(isLoading) {
        createIssueBtn.disabled = isLoading;
        createIssueBtn.textContent = isLoading ? "Creating..." : "Create Issue";
        
        if (isLoading) {
            createIssueBtn.style.cursor = "not-allowed";
            createIssueBtn.style.opacity = "0.7";
        } else {
            createIssueBtn.style.cursor = "pointer";
            createIssueBtn.style.opacity = "1";
        }
    }

    // Debounced create issue function
    const debouncedCreateIssue = debounce(async () => {
        const bugDescription = description.value.trim();
        if (!bugDescription) {
            alert("⚠️ Please enter a description for the issue.");
            return;
        }
        
        setLoading(true);
        
        try {
            const issueContent = await generateIssueDetails(bugDescription);
            
            const issueLines = issueContent.split("\n");
            const title = issueLines.find(line => line.toLowerCase().includes('title'))
                ?.replace(/title:\s*/i, '').trim() || 
                issueLines[0].replace(/^[^\w]*/, '').trim();
            
            const body = issueLines.slice(1).join("\n").trim();
            
            await createGitHubIssue(title, body);
        } catch (error) {
            // Error already handled in the API functions
        } finally {
            setLoading(false);
        }
    }, 500);

    createIssueBtn.addEventListener("click", debouncedCreateIssue);

    // Preload settings on startup
    loadSettings();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            if (!createIssueBtn.disabled && !issueContainer.classList.contains('hidden')) {
                debouncedCreateIssue();
            }
        }
    });
});
