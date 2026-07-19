export default function BackToTopButton() {
  function scrollToTop() {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <button type="button" className="back-to-top-btn" onClick={scrollToTop}>
      ↑ ページ上部へ戻る
    </button>
  )
}
