/**
 * navigator.clipboard 는 HTTPS 또는 localhost 에서만 동작하는 경우가 많음.
 * (예: http://IP:포트 로 접속하면 clipboard 가 undefined)
 * 사용자 제스처 안에서 execCommand 로 폴백한다.
 */
export async function copyPlainText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) {
      throw new Error("execCommand copy returned false");
    }
  } finally {
    document.body.removeChild(ta);
  }
}

export async function copyHtmlForWord(html: string, plain: string): Promise<void> {
  const ClipboardItemCtor = (globalThis as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem })
    .ClipboardItem;

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.write &&
    ClipboardItemCtor
  ) {
    const item = new ClipboardItemCtor({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await copyPlainText(plain);
}
