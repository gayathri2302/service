import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createGitlabClient, CURRENT_USER_ID } from '../gitlab.js';

const router    = Router();
const execAsync = promisify(exec);
const repoPath  = process.env.LOCAL_REPO_PATH!;

function client(projectId: string) {
  return createGitlabClient(projectId);
}

// ── MR list & details ───────────────────────────────────────────────────────

router.get('/:projectId/mrs', async (req, res) => {
  try {
    const state = (req.query.state as string) || 'opened';
    res.json(await client(req.params.projectId).listMRs(state));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/changes', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getMRChanges(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/commits', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getMRCommits(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/approvals', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getMRApprovals(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── MR actions ──────────────────────────────────────────────────────────────

router.post('/:projectId/mrs/:id/merge', async (req, res) => {
  try {
    const gl    = client(req.params.projectId);
    const mrIid = Number(req.params.id);
    const merged = await gl.mergeMR(mrIid, req.body.commitMessage);
    const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    await gl.createMRNote(mrIid, `✅ Merged by Gayathri on ${now}`).catch(() => {});
    res.json(merged);
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

router.post('/:projectId/mrs/:id/close', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).closeMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs/:id/reopen', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).reopenMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/mrs/:id/draft', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).setDraft(Number(req.params.id), req.body.draft as boolean));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.put('/:projectId/mrs/:id', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).updateMR(Number(req.params.id), req.body));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).createMR(req.body));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.get('/:projectId/branches', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getBranches(req.query.search as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Emoji reactions ─────────────────────────────────────────────────────────

router.get('/:projectId/mrs/:id/emojis', async (req, res) => {
  try {
    const all = await client(req.params.projectId).getAwardEmojis(Number(req.params.id));
    res.json(all.map((e: any) => ({ ...e, is_mine: e.user?.id === CURRENT_USER_ID })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/mrs/:id/emojis', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).addAwardEmoji(Number(req.params.id), req.body.name));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.delete('/:projectId/mrs/:id/emojis/:awardId', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).removeAwardEmoji(Number(req.params.id), Number(req.params.awardId)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Pipelines ───────────────────────────────────────────────────────────────

router.get('/:projectId/pipelines', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).listPipelines(30));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/pipeline-detail', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getLatestPipelineForMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/pipelines/:id/jobs', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getPipelineJobs(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/pipelines/:id/cancel', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).cancelPipeline(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/pipelines/:id/retry', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).retryPipeline(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/pipelines', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).triggerPipeline(req.body.ref));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

// ── Jobs ────────────────────────────────────────────────────────────────────

router.post('/:projectId/jobs/:id/play', async (req, res) => {
  try {
    const isBridge = req.body?.isBridge === true;
    res.json(await client(req.params.projectId).playJob(Number(req.params.id), isBridge));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/jobs/:id/retry', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).retryJob(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: detail });
  }
});

router.post('/:projectId/jobs/:id/cancel', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).cancelJob(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.get('/:projectId/jobs/:id/trace', async (req, res) => {
  try {
    res.type('text/plain').send(await client(req.params.projectId).getJobTrace(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Deployments ─────────────────────────────────────────────────────────────

router.get('/:projectId/deployments/blocked', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).getBlockedDeployments());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/deployments/:id/approval', async (req, res) => {
  try {
    res.json(await client(req.params.projectId).approveDeployment(
      Number(req.params.id), req.body.status || 'approved', req.body.comment,
    ));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

// ── SourceTree ──────────────────────────────────────────────────────────────

router.post('/:projectId/mrs/:id/open-sourcetree', async (req, res) => {
  try {
    const mr = await client(req.params.projectId).getMR(Number(req.params.id));
    await execAsync(`git -C "${repoPath}" fetch origin "${mr.source_branch}"`, { timeout: 30000 });
    await execAsync(`open -a SourceTree "${repoPath}"`);
    res.json({ success: true, branch: mr.source_branch, message: `Fetched "${mr.source_branch}" and opened SourceTree` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Diagnostics ─────────────────────────────────────────────────────────────

router.get('/whoami', async (_req, res) => {
  try {
    const token = process.env.GITLAB_TOKEN!;
    const url   = process.env.GITLAB_URL!;
    const { default: axios } = await import('axios');
    const result = await axios.get(`${url}/api/v4/user`, {
      headers: { 'PRIVATE-TOKEN': token },
    });
    res.json({ user: result.data, token_prefix: token?.slice(0, 6) + '...' });
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

export default router;
