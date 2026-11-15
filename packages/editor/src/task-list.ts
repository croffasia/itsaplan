// The api and the web compile this file without the package's own declarations.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/markdown-it-task-lists.d.ts" />
import { TaskList } from '@tiptap/extension-list';
import type MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

// markdown-it-task-lists marks a whole list as a task list when any item is a task, and
// the editor has no plain item inside a task list or a numbered task list. Each run of
// tasks becomes a task list of its own, the other items stay in a list of the original
// kind and keep their numbers, and a numbered task list loses its numbers.
export function splitTaskLists(root: Element) {
  for (const list of root.querySelectorAll('.contains-task-list')) {
    const runs: { task: boolean; items: Element[] }[] = [];
    for (const item of list.children) {
      const task = item.classList.contains('task-list-item');
      const last = runs.at(-1);
      if (last?.task === task) last.items.push(item);
      else runs.push({ task, items: [item] });
    }
    const start = Number(list.getAttribute('start') ?? 1);
    let position = 0;
    const lists = runs.map((run) => {
      const element = list.ownerDocument.createElement(run.task ? 'ul' : list.localName);
      if (run.task) element.setAttribute('data-type', 'taskList');
      else if (list.localName === 'ol' && start + position !== 1)
        element.setAttribute('start', String(start + position));
      position += run.items.length;
      element.append(...run.items);
      return element;
    });
    list.replaceWith(...lists);
  }
}

export function useTaskLists(markdown: MarkdownIt) {
  markdown.use(taskLists);
}

// It replaces the task-list parse rule tiptap-markdown ships, and keeps its serializer.
export const MarkdownTaskList = TaskList.extend({
  addStorage() {
    return {
      markdown: {
        parse: {
          setup: useTaskLists,
          updateDOM: splitTaskLists,
        },
      },
    };
  },
});
