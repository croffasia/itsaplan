import { getObjectText } from '@repo/storage';
import type { AttachmentDownload, Page, SourceReader } from './reader';
import type {
  CanonicalAttachment,
  CanonicalComment,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalRelation,
  CanonicalState,
} from './canonical';
import {
  MSPROJECT_STATES,
  mapMsProjectLabels,
  mapMsProjectRelations,
  mapMsProjectTask,
  parseMspdi,
  type MsProjectPlan,
} from './msproject-mapping';

// The SourceReader for an MS Project plan saved as MSPDI XML. The api stores the
// uploaded file in the object store; this reader parses it once and serves every
// call from memory. It needs no credential and makes no request to a source.
// docs/dev/msproject-import.md has the details.

const PAGE_SIZE = 100;

export class MsProjectReader implements SourceReader {
  private plan: Promise<MsProjectPlan> | null = null;

  constructor(
    private readonly fileKey: string,
    private readonly readFile: (key: string) => Promise<string> = getObjectText,
  ) {}

  async listStates(): Promise<CanonicalState[]> {
    return MSPROJECT_STATES;
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    return mapMsProjectLabels(await this.load());
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    return [];
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const plan = await this.load();
    const offset = cursor ? Number(cursor) : 0;
    const next = offset + PAGE_SIZE;
    return {
      items: plan.tasks.slice(offset, next).map((t) => mapMsProjectTask(t, plan)),
      cursor: next < plan.tasks.length ? String(next) : null,
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    const plan = await this.load();
    return mapMsProjectTask(this.task(plan, sourceId), plan);
  }

  async listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]> {
    const plan = await this.load();
    return mapMsProjectRelations(this.task(plan, issueSourceId), plan);
  }

  async listIssueComments(): Promise<CanonicalComment[]> {
    return [];
  }

  async listIssueAttachments(): Promise<CanonicalAttachment[]> {
    return [];
  }

  async resolveAttachmentDownload(): Promise<AttachmentDownload> {
    throw new Error('MS Project plans have no attachments');
  }

  private task(plan: MsProjectPlan, uid: string) {
    const task = plan.tasks.find((t) => t.uid === uid);
    if (!task) throw new Error(`MS Project task ${uid} is not in the file`);
    return task;
  }

  private load(): Promise<MsProjectPlan> {
    this.plan ??= this.readFile(this.fileKey).then(parseMspdi);
    return this.plan;
  }
}
