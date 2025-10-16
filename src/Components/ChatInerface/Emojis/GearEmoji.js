export default function GearEmoji({ size = 32, className = '' }) {
 return (
   <picture className={className}>
     <source 
       srcset="https://fonts.gstatic.com/s/e/notoemoji/latest/2699_fe0f/512.webp"
       type="image/webp" 
     />
     <img 
       src="https://fonts.gstatic.com/s/e/notoemoji/latest/2699_fe0f/512.gif"
        
       width={size} 
       height={size} 
     />
   </picture>
 );
}
