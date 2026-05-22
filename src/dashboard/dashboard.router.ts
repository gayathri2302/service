import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Request, Response, NextFunction } from 'express';
import { createGitlabClient, CURRENT_USER_ID } from '../gitlab.js';

function requireMerger(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'merger') {
    return res.status(403).json({ error: 'Permission denied: only mergers can perform this action.' });
  }
  next();
}

const router    = Router();
const execAsync = promisify(exec);
const repoPath  = process.env.LOCAL_REPO_PATH!;

function client(projectId: string | string[], username?: string) {
  return createGitlabClient(String(projectId), username);
}

// ── MR list & details ───────────────────────────────────────────────────────

router.get('/:projectId/mrs', async (req, res) => {
  try {
    const state = (req.query.state as string) || 'opened';
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const search = (req.query.search as string) || '';
    res.json(await client(req.params.projectId, req.user?.name).listMRs(state, page, perPage, search));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/commits/:sha/diff', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getCommitDiff(req.params.sha));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/commits/:sha', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getCommitDetail(req.params.sha));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/changes', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getMRChanges(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/commits', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getMRCommits(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/approvals', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getMRApprovals(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── MR actions ──────────────────────────────────────────────────────────────

router.post('/:projectId/mrs/:id/merge', requireMerger, async (req, res) => {
  try {
    const gl    = client(req.params.projectId, req.user?.name);
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
    res.json(await client(req.params.projectId, req.user?.name).closeMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs/:id/reopen', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).reopenMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/mrs/:id/draft', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).setDraft(Number(req.params.id), req.body.draft as boolean));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs/:id/approve', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).approveMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs/:id/unapprove', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).unapproveMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.put('/:projectId/mrs/:id', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).updateMR(Number(req.params.id), req.body));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post('/:projectId/mrs', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).createMR(req.body));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.get('/:projectId/branches', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getBranches(req.query.search as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Emoji reactions ─────────────────────────────────────────────────────────

router.get('/:projectId/mrs/:id/emojis', async (req, res) => {
  try {
    const all = await client(req.params.projectId, req.user?.name).getAwardEmojis(Number(req.params.id));
    res.json(all.map((e: any) => ({ ...e, is_mine: e.user?.id === CURRENT_USER_ID })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/mrs/:id/emojis', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).addAwardEmoji(Number(req.params.id), req.body.name));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.delete('/:projectId/mrs/:id/emojis/:awardId', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).removeAwardEmoji(Number(req.params.id), Number(req.params.awardId)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Discussions ─────────────────────────────────────────────────────────────

router.get('/:projectId/mrs/:id/discussions', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getMRDiscussions(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/mrs/:id/discussions/:discussionId/reply', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).createDiscussionReply(Number(req.params.id), req.params.discussionId, req.body.body));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.put('/:projectId/mrs/:id/discussions/:discussionId/resolve', requireMerger, async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).resolveDiscussion(Number(req.params.id), String(req.params.discussionId), req.body.resolved));
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.get('/:projectId/pipelines', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).listPipelines(30));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/mrs/:id/pipeline-detail', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getLatestPipelineForMR(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:projectId/pipelines/:id/jobs', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getPipelineJobs(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/pipelines/:id/cancel', requireMerger, async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).cancelPipeline(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/pipelines/:id/retry', requireMerger, async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).retryPipeline(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/pipelines', requireMerger, async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).triggerPipeline(req.body.ref));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

// ── Jobs ────────────────────────────────────────────────────────────────────

router.post('/:projectId/jobs/:id/play', async (req, res) => {
  try {
    const isBridge = req.body?.isBridge === true;
    res.json(await client(req.params.projectId, req.user?.name).playJob(Number(req.params.id), isBridge));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/:projectId/jobs/:id/retry', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).retryJob(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: detail });
  }
});

router.post('/:projectId/jobs/:id/cancel', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).cancelJob(Number(req.params.id)));
  } catch (e: any) {
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    res.status(e.response?.status || 500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.get('/:projectId/jobs/:id/trace', async (req, res) => {
  try {
    res.type('text/plain').send(await client(req.params.projectId, req.user?.name).getJobTrace(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Deployments ─────────────────────────────────────────────────────────────

router.get('/:projectId/deployments/blocked', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).getBlockedDeployments());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:projectId/deployments/:id/approval', async (req, res) => {
  try {
    res.json(await client(req.params.projectId, req.user?.name).approveDeployment(
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
    const mr = await client(req.params.projectId, req.user?.name).getMR(Number(req.params.id));
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
