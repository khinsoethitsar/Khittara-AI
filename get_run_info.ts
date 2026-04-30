
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "khinsoethitsar";
const REPO = "Khittara-AI";

async function getRunInfo(runId: string) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  
  if (!response.ok) return;
  const run = await response.json();
  console.log(`Run ID: ${run.id}, Name: ${run.name}, Status: ${run.status}, Conclusion: ${run.conclusion}`);
}

getRunInfo("24935591637");
