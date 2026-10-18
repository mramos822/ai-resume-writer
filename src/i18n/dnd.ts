import type { Tr } from "@/i18n/translate";

/** The texts that the drag and drop library reads out to screen readers, in the language of the page. */
export function dndAccessibility(tr: Tr) {
  return {
    screenReaderInstructions: {
      draggable: tr("To pick up a draggable item, press the space bar. While dragging, use the arrow keys to move the item. Press space again to drop the item in its new position, or press escape to cancel."),
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => tr("Picked up item {id}.", { id: String(active.id) }),
      onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? tr("Item {id} was moved over {over}.", { id: String(active.id), over: String(over.id) }) : tr("Item {id} is no longer over a place where it can be dropped.", { id: String(active.id) }),
      onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? tr("Item {id} was dropped over {over}.", { id: String(active.id), over: String(over.id) }) : tr("Item {id} was dropped.", { id: String(active.id) }),
      onDragCancel: ({ active }: { active: { id: string | number } }) => tr("Dragging was cancelled. Item {id} was dropped.", { id: String(active.id) }),
    },
  };
}
