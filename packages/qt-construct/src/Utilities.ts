/**
 * Set the CSS classes on a widget and update
 */
import { QWidget } from "@nodegui/nodegui";

export function setCssClasses(widget: QWidget, classes: string[]): void {
  widget.setProperty("cssClass", classes);
  repolish(widget);
}

/**
 * Force Qt to reapply styles to a widget
 */
export function repolish(widget: QWidget): void {
  const style = widget.style();
  style.unpolish(widget);
  style.polish(widget);
}
