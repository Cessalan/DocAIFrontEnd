export default function CookingEmoji({ size = 32, className = '' }) {
 return (
   <picture className={className}>
     <source 
       srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f373/512.webp" 
       type="image/webp" 
     />
     <img 
       src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f373/512.gif" 
       alt="🍳" 
       width={size} 
       height={size} 
     />
   </picture>
 );
}