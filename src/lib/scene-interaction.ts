type Pointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
};

export class ScenePointerGesture {
  private pointers = new Set<number>();
  private start: Pointer | null = null;
  private dragged = false;

  down(event: Pointer) {
    this.pointers.add(event.pointerId);
    if (this.pointers.size === 1) {
      this.start = event;
      this.dragged = false;
    } else this.dragged = true;
  }

  move(event: Pointer) {
    if (this.start?.pointerId === event.pointerId &&
      Math.hypot(event.clientX - this.start.clientX, event.clientY - this.start.clientY) >= 5)
      this.dragged = true;
  }

  up(event: Pointer) {
    this.move(event);
    const click = this.pointers.size === 1 && this.start?.pointerId === event.pointerId &&
      this.start.button === 0 && event.button === 0 && !this.dragged;
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) this.start = null;
    return click;
  }

  cancel() {
    this.pointers.clear();
    this.start = null;
    this.dragged = false;
  }
}
