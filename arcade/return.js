(()=>{
const existing=document.querySelector('a[aria-label="Back to arcade"]');
if(existing){existing.setAttribute('aria-label','Return to the arcade');return;}
// Kept clear of game input and the phone's bottom controls.
const link=document.createElement('a');link.href='../';link.textContent='← Arcade';link.setAttribute('aria-label','Return to the arcade');
Object.assign(link.style,{position:'fixed',bottom:'8px',right:'10px',zIndex:'100',font:'11px system-ui,sans-serif',color:'#fff3cf',background:'#191e20e8',padding:'8px 12px',border:'1px solid #ffffff35',borderRadius:'5px',textDecoration:'none',boxShadow:'0 2px 8px #0003'});
if(location.pathname.includes('burger-tycoon'))link.style.bottom='76px';
link.addEventListener('keydown',event=>event.stopPropagation());
document.body.append(link);

})();
