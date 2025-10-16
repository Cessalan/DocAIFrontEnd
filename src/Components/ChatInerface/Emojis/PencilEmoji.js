export default function PencilEmoji({ size = 32, className = '' }) {
 return (
   <picture className={className}>
     <source 
       srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/270f_fe0f/512.webp" 
       type="image/webp" 
     />
     <img 
       src="https://fonts.gstatic.com/s/e/notoemoji/latest/270f_fe0f/512.gif" 
       alt="✏" 
       width={size} 
       height={size} 
     />
   </picture>
 );
}