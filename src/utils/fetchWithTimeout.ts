/**
 * fetchには既定のタイムアウトがなく、通信が詰まると呼び出し元は永遠にPromiseの解決を待ち続ける。
 * AbortControllerで上限時間を切り、タイムアウト時は分かりやすい日本語メッセージのErrorを投げる。
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(timeoutMessage)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
