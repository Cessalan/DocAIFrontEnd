export default function ReadingEmoji({ size = 32 }) {
  return (
    <picture>
      <source 
        srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f9d0/512.webp" 
        type="image/webp" 
      />
      <img 
        src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f9d0/512.gif" 
        alt="🧐" 
        width={size} 
        height={size} 
      />
    </picture>
  );
}
