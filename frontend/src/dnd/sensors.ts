import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Mouse + touch + keyboard sensors tuned for list reordering:
 * - mouse needs a short drag distance so clicks still reach buttons
 * - touch uses a press-and-hold delay so vertical page scroll stays usable
 * - keyboard via arrow keys when a drag handle is focused
 */
export function useListSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
