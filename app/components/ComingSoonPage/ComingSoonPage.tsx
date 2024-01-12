import { pageStyles, titleStyles, subtitleStyles } from "./styles.css";
// Render the page
function ComingSoonPage() {
  return (
    <div className={pageStyles}>
      <h1 className={titleStyles}>Coming Soon</h1>
      <p className={subtitleStyles}>Prepare to be amazed!</p>
    </div>
  );
}

export default ComingSoonPage;
