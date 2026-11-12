const BASE_Z_INDEX = 1200;
const Z_INDEX_STEP = 20;

type BodyStyles = {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
};

const stack: number[] = [];
let nextId = 1;
let savedScrollY = 0;
let savedBody: BodyStyles | null = null;
let savedHtmlOverflow = '';

function currentScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export function acquireDialogLock(): { id: number; zIndex: number } {
  const id = nextId++;
  if (stack.length === 0) {
    const body = document.body;
    savedScrollY = window.scrollY;
    savedBody = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    savedHtmlOverflow = document.documentElement.style.overflow;
    const gutter = currentScrollbarWidth();
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (gutter > 0) {
      body.style.paddingRight = `${gutter}px`;
    }
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.dataset.dialogOpen = 'true';
  }
  stack.push(id);
  return { id, zIndex: BASE_Z_INDEX + (stack.length - 1) * Z_INDEX_STEP };
}

export function releaseDialogLock(id: number) {
  const index = stack.indexOf(id);
  if (index >= 0) {
    stack.splice(index, 1);
  }
  if (stack.length > 0 || !savedBody) {
    return;
  }
  const body = document.body;
  body.style.overflow = savedBody.overflow;
  body.style.position = savedBody.position;
  body.style.top = savedBody.top;
  body.style.left = savedBody.left;
  body.style.right = savedBody.right;
  body.style.width = savedBody.width;
  body.style.paddingRight = savedBody.paddingRight;
  document.documentElement.style.overflow = savedHtmlOverflow;
  delete document.documentElement.dataset.dialogOpen;
  savedBody = null;
  window.scrollTo(0, savedScrollY);
}

export function isTopDialog(id: number) {
  return stack[stack.length - 1] === id;
}

export function openDialogCount() {
  return stack.length;
}
