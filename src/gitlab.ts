import axios from 'axios';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const GITLAB_URL = process.env.GITLAB_URL!;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN!;
export const CURRENT_USER_ID = Number(process.env.GITLAB_CURRENT_USER_ID || '0');

const USER_TOKEN_RULES: Array<{ match: string; token: string | undefined }> = [
  { match: 'thendral', token: process.env.GITLAB_TA_TOKEN },
  { match: 'priyanka', token: process.env.GITLAB_PP_TOKEN },
  { match: 'gayathri', token: process.env.GITLAB_TOKEN },
];

function resolveToken(username?: string): string {
  if (username) {
    const lower = username.toLowerCase();
    const rule  = USER_TOKEN_RULES.find(r => lower.includes(r.match));
    if (rule?.token) return rule.token;
  }
  return GITLAB_TOKEN;
}

function makeApi(projectId: number | string, username?: string) {
  return axios.create({
    baseURL: `${GITLAB_URL}/api/v4/projects/${projectId}`,
    headers: { 'PRIVATE-TOKEN': resolveToken(username) },
  });
}

export function createGitlabClient(projectId: number | string, username?: string) {
  const api = makeApi(projectId, username);

  return {
    listMRs: async (
      state = 'opened',
      page = 1,
      perPage = 20,
      search = '',
      filters: {
        sourceBranch?: string;
        targetBranch?: string;
        authorUsername?: string;
        mergedByUsername?: string;
        orderBy?: string;
        sort?: string;
      } = {}
    ) => {
      const {
        sourceBranch,
        targetBranch,
        authorUsername,
        mergedByUsername,
        orderBy = 'updated_at',
        sort = 'desc',
      } = filters;

      const sourceBranchTerm = sourceBranch?.trim().toLowerCase() ?? '';
      const targetBranchTerm = targetBranch?.trim().toLowerCase() ?? '';
      const authorTerm = authorUsername?.trim().toLowerCase() ?? '';
      const mergedByTerm = mergedByUsername?.trim().toLowerCase() ?? '';
      const searchTerm = search.trim().toLowerCase();

      const baseParams: any = {
        state,
        per_page: perPage,
        order_by: orderBy,
        sort,
        page,
      };

      const hasClientFiltering = Boolean(
        searchTerm || sourceBranchTerm || targetBranchTerm || authorTerm || mergedByTerm,
      );

      const headerToPositiveNumber = (value: unknown): number | null => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      const resolvePagination = (
        currentPage: number,
        currentPerPage: number,
        itemCount: number,
        headers: Record<string, unknown>,
      ) => {
        const totalPagesHeader = headerToPositiveNumber(headers['x-total-pages']);
        const totalCountHeader = headerToPositiveNumber(headers['x-total']);
        const nextPageHeader = headerToPositiveNumber(headers['x-next-page']);

        const hasNext = nextPageHeader !== null
          || ((totalPagesHeader === null || currentPage < totalPagesHeader) && itemCount === currentPerPage);

        const totalPages = totalPagesHeader ?? (hasNext ? currentPage + 1 : currentPage);
        const totalCount = totalCountHeader
          ?? (hasNext ? currentPage * currentPerPage + 1 : ((currentPage - 1) * currentPerPage + itemCount));

        return {
          page: currentPage,
          perPage: currentPerPage,
          totalPages,
          totalCount,
        };
      };

      const sortDeduped = (list: any[]) => {
        list.sort((a: any, b: any) => {
          if (orderBy === 'id') return sort === 'asc' ? a.iid - b.iid : b.iid - a.iid;
          const field = orderBy === 'created_at' ? 'created_at' : 'updated_at';
          const diff = new Date(a[field]).getTime() - new Date(b[field]).getTime();
          return sort === 'asc' ? diff : -diff;
        });
      };

      const matchesText = (value: string | null | undefined, term: string) =>
        !term || (value ?? '').toLowerCase().includes(term);

      const matchesMR = (mr: any) =>
        matchesText(mr.source_branch, sourceBranchTerm) &&
        matchesText(mr.target_branch, targetBranchTerm) &&
        (
          !authorTerm ||
          matchesText(mr.author?.username, authorTerm) ||
          matchesText(mr.author?.name, authorTerm)
        ) &&
        (
          !mergedByTerm ||
          matchesText(mr.merged_by?.username, mergedByTerm) ||
          matchesText(mr.merged_by?.name, mergedByTerm)
        ) &&
        (
          !searchTerm ||
          matchesText(mr.title, searchTerm) ||
          matchesText(mr.author?.name, searchTerm) ||
          matchesText(mr.author?.username, searchTerm)
        );

      if (!hasClientFiltering) {
        const res = await api.get('/merge_requests', { params: baseParams });
        return {
          data: res.data,
          pagination: resolvePagination(page, perPage, (res.data as any[]).length, res.headers as Record<string, unknown>),
        };
      }

      const filteredAccumulated: any[] = [];
      const seen = new Set<number>();
      let apiPage = 1;
      let pagesFetched = 0;
      const maxPages = 200;
      const neededForPage = page * perPage;
      let hasMoreMatchesBeyondCurrentWindow = false;

      while (true) {
        if (pagesFetched >= maxPages) {
          hasMoreMatchesBeyondCurrentWindow = true;
          break;
        }
        pagesFetched += 1;

        const res = await api.get('/merge_requests', {
          params: { ...baseParams, page: apiPage, per_page: 100 },
        });
        const items = res.data as any[];
        const previousSeenSize = seen.size;

        for (const mr of items) {
          if (seen.has(mr.iid)) continue;
          seen.add(mr.iid);
          if (matchesMR(mr)) {
            filteredAccumulated.push(mr);
            if (filteredAccumulated.length > neededForPage) {
              hasMoreMatchesBeyondCurrentWindow = true;
              break;
            }
          }
        }

        if (hasMoreMatchesBeyondCurrentWindow) break;

        const addedNewItems = seen.size > previousSeenSize;
        const nextPageHeader = headerToPositiveNumber((res.headers as Record<string, unknown>)['x-next-page']);
        const hasNextByLength = items.length === 100;

        if (nextPageHeader !== null) {
          if (nextPageHeader <= apiPage || !addedNewItems) break;
          apiPage = nextPageHeader;
          continue;
        }

        if (!hasNextByLength || !addedNewItems) break;
        apiPage += 1;
      }

      sortDeduped(filteredAccumulated);

      const start = (page - 1) * perPage;
      const data = filteredAccumulated.slice(start, start + perPage);
      const totalCount = hasMoreMatchesBeyondCurrentWindow
        ? start + data.length + 1
        : start + data.length;
      const totalPages = hasMoreMatchesBeyondCurrentWindow
        ? page + 1
        : (totalCount === 0 ? 1 : Math.ceil(totalCount / perPage));

      return {
        data,
        pagination: {
          page,
          perPage,
          totalPages,
          totalCount,
        },
      };
    },

    getMR: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}`);
      return res.data;
    },

    getCommitDiff: async (sha: string) => {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const res = await api.get(`/repository/commits/${sha}/diff`, {
          params: { per_page: 100, page },
        });
        const items: any[] = res.data;
        all.push(...items);
        const totalPages = Number(res.headers['x-total-pages'] || 1);
        if (page >= totalPages || items.length === 0) break;
        page++;
      }
      return all;
    },

    getCommitDetail: async (sha: string) => {
      const res = await api.get(`/repository/commits/${sha}`);
      return res.data;
    },

    getMRChanges: async (mrIid: number) => {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const res = await api.get(`/merge_requests/${mrIid}/diffs`, {
          params: { per_page: 100, page },
        });
        const items: any[] = res.data;
        all.push(...items);
        const totalPages = Number(res.headers['x-total-pages'] || 1);
        if (page >= totalPages || items.length === 0) break;
        page++;
      }
      return all;
    },

    getMRCommits: async (mrIid: number) => {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const res = await api.get(`/merge_requests/${mrIid}/commits`, {
          params: { per_page: 100, page },
        });
        const items: any[] = res.data;
        all.push(...items);
        const totalPages = Number(res.headers['x-total-pages'] || 1);
        if (page >= totalPages || items.length === 0) break;
        page++;
      }
      return all;
    },

    getMRApprovals: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}/approvals`);
      return res.data;
    },

    getMRNotes: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}/notes`, {
        params: { per_page: 50, sort: 'asc' },
      });
      return res.data;
    },

    createMRNote: async (mrIid: number, body: string) => {
      const res = await api.post(`/merge_requests/${mrIid}/notes`, { body });
      return res.data;
    },

    // Discussions (grouped comments)
    getMRDiscussions: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}/discussions`, {
        params: { per_page: 100 },
      });
      return res.data;
    },

    createDiscussionReply: async (mrIid: number, discussionId: string, body: string) => {
      const res = await api.post(`/merge_requests/${mrIid}/discussions/${discussionId}/notes`, { body });
      return res.data;
    },

    resolveDiscussion: async (mrIid: number, discussionId: string, resolved: boolean) => {
      const res = await api.put(`/merge_requests/${mrIid}/discussions/${discussionId}`, { resolved });
      return res.data;
    },

    // Award emoji (like / dislike / reactions)
    getAwardEmojis: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}/award_emoji`);
      return res.data;
    },

    addAwardEmoji: async (mrIid: number, name: string) => {
      const res = await api.post(`/merge_requests/${mrIid}/award_emoji`, { name });
      return res.data;
    },

    removeAwardEmoji: async (mrIid: number, awardId: number) => {
      await api.delete(`/merge_requests/${mrIid}/award_emoji/${awardId}`);
      return { success: true };
    },

    // Merge / close / reopen
    mergeMR: async (mrIid: number, commitMessage?: string) => {
      const body: Record<string, string> = {};
      if (commitMessage) body.merge_commit_message = commitMessage;
      const res = await api.put(`/merge_requests/${mrIid}/merge`, body);
      return res.data;
    },

    closeMR: async (mrIid: number) => {
      const res = await api.put(`/merge_requests/${mrIid}`, { state_event: 'close' });
      return res.data;
    },

    reopenMR: async (mrIid: number) => {
      const res = await api.put(`/merge_requests/${mrIid}`, { state_event: 'reopen' });
      return res.data;
    },

    // Draft toggle — set/unset "Draft:" prefix via the draft field
    setDraft: async (mrIid: number, draft: boolean) => {
      const res = await api.put(`/merge_requests/${mrIid}`, { draft });
      return res.data;
    },

    // Approve / Unapprove MR
    approveMR: async (mrIid: number) => {
      const res = await api.post(`/merge_requests/${mrIid}/approve`);
      return res.data;
    },

    unapproveMR: async (mrIid: number) => {
      const res = await api.post(`/merge_requests/${mrIid}/unapprove`);
      return res.data;
    },

    // Create MR
    createMR: async (params: {
      source_branch: string;
      target_branch: string;
      title: string;
      description?: string;
      assignee_id?: number;
      draft?: boolean;
    }) => {
      const res = await api.post('/merge_requests', params);
      return res.data;
    },

    // Update MR (title, description, source/target branch)
    updateMR: async (mrIid: number, params: { title?: string; description?: string; source_branch?: string; target_branch?: string }) => {
      const res = await api.put(`/merge_requests/${mrIid}`, params);
      return res.data;
    },

    // List recent pipelines for the project
    listPipelines: async (perPage = 30) => {
      const res = await api.get('/pipelines', {
        params: { per_page: perPage, order_by: 'id', sort: 'desc' },
      });
      return res.data;
    },

    // Get branches for the create MR form
    getBranches: async (search?: string) => {
      const params: Record<string, any> = { per_page: 50 };
      if (search) params.search = search;
      const res = await api.get('/repository/branches', { params });
      return res.data;
    },

    // Pipelines
    getMRPipelines: async (mrIid: number) => {
      const res = await api.get(`/merge_requests/${mrIid}/pipelines`);
      return res.data;
    },

    getPipeline: async (pipelineId: number) => {
      const res = await api.get(`/pipelines/${pipelineId}`);
      return res.data;
    },

    getPipelineJobs: async (pipelineId: number) => {
      // Fetch both regular jobs and bridge jobs (manual approvals, downstream triggers)
      const [jobsRes, bridgesRes] = await Promise.all([
        api.get(`/pipelines/${pipelineId}/jobs`, { params: { per_page: 100 } }),
        api.get(`/pipelines/${pipelineId}/bridges`, { params: { per_page: 100 } }).catch(() => ({ data: [] })),
      ]);
      // Mark bridge jobs so the frontend knows the type
      const bridges = bridgesRes.data.map((b: any) => ({ ...b, _is_bridge: true }));
      return [...jobsRes.data, ...bridges];
    },

    getJobTrace: async (jobId: number) => {
      const res = await api.get(`/jobs/${jobId}/trace`, { responseType: 'text' });
      return res.data;
    },

    playJob: async (jobId: number, isBridge = false) => {
      if (isBridge) {
        // For bridge jobs, we need to try the play endpoint
        // Bridge jobs don't have /play — but they may be triggered via the jobs endpoint too
        // Try regular job play first, fall back to bridge-specific handling
        try {
          const res = await api.post(`/jobs/${jobId}/play`);
          return res.data;
        } catch (err: any) {
          // If it's a 404 (not a regular job), try as a bridge
          if (err.response?.status === 404) {
            // For manual bridge jobs, we need to use the downstream pipeline play
            throw new Error('Bridge jobs must be triggered from GitLab UI or via deployment approvals');
          }
          throw err;
        }
      }
      const res = await api.post(`/jobs/${jobId}/play`);
      return res.data;
    },

    retryJob: async (jobId: number) => {
      const res = await api.post(`/jobs/${jobId}/retry`);
      return res.data;
    },

    cancelJob: async (jobId: number) => {
      const res = await api.post(`/jobs/${jobId}/cancel`);
      return res.data;
    },

    cancelPipeline: async (pipelineId: number) => {
      const res = await api.post(`/pipelines/${pipelineId}/cancel`);
      return res.data;
    },

    retryPipeline: async (pipelineId: number) => {
      const res = await api.post(`/pipelines/${pipelineId}/retry`);
      return res.data;
    },

    triggerPipeline: async (ref: string) => {
      const res = await api.post('/pipeline', { ref });
      return res.data;
    },

    getBlockedDeployments: async () => {
      const res = await api.get('/deployments', {
        params: { status: 'blocked', per_page: 20, order_by: 'id', sort: 'desc' },
      });
      return res.data;
    },

    approveDeployment: async (deploymentId: number, status: 'approved' | 'rejected' = 'approved', comment?: string) => {
      const body: Record<string, string> = { status };
      if (comment) body.comment = comment;
      const res = await api.post(`/deployments/${deploymentId}/approval`, body);
      return res.data;
    },

    getPipelinesBySha: async (sha: string) => {
      const res = await api.get('/pipelines', { params: { sha, per_page: 5 } });
      return res.data;
    },

    getPipelinesByRef: async (ref: string) => {
      const res = await api.get('/pipelines', {
        params: { ref, per_page: 5, order_by: 'id', sort: 'desc' },
      });
      return res.data;
    },

    getLatestPipelineForMR: async (mrIid: number) => {
      const client = createGitlabClient(projectId);

      const mrPipelines = await client.getMRPipelines(mrIid);
      if (mrPipelines.length) {
        const [pipeline, jobs] = await Promise.all([
          client.getPipeline(mrPipelines[0].id),
          client.getPipelineJobs(mrPipelines[0].id),
        ]);
        return { pipeline, jobs, source: 'mr' };
      }

      const mr = await client.getMR(mrIid);

      if (mr.state === 'merged' && mr.merge_commit_sha) {
        const byMergeSha = await client.getPipelinesBySha(mr.merge_commit_sha);
        if (byMergeSha.length) {
          const [pipeline, jobs] = await Promise.all([
            client.getPipeline(byMergeSha[0].id),
            client.getPipelineJobs(byMergeSha[0].id),
          ]);
          return { pipeline, jobs, source: 'merge_commit' };
        }
      }

      if (mr.target_branch) {
        const byBranch = await client.getPipelinesByRef(mr.target_branch);
        if (byBranch.length) {
          const [pipeline, jobs] = await Promise.all([
            client.getPipeline(byBranch[0].id),
            client.getPipelineJobs(byBranch[0].id),
          ]);
          return { pipeline, jobs, source: 'target_branch' };
        }
      }

      return null;
    },
  };
}

// Default client for MCP tools
export const gitlab = createGitlabClient(process.env.GITLAB_PROJECT_ID!);
