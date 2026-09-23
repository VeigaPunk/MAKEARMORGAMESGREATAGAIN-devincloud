(()=>{
const existing=document.querySelector('a[aria-label="Back to arcade"]');
if(existing){existing.setAttribute('aria-label','Return to the arcade');return;}
// Kept clear of game input and the phone's bottom controls.
const link=document.createElement('a');link.href='../';link.textContent='← Arcade';link.style.backgroundImage="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 44'%3E%3Cg fill='none' stroke='%23e6b847' stroke-width='5'%3E%3Cellipse cx='20' cy='17' rx='13' ry='7.5'/%3E%3Cellipse cx='44' cy='17' rx='13' ry='7.5'/%3E%3C/g%3E%3Crect x='27' y='11' width='10' height='13' rx='3' fill='%23e6b847'/%3E%3C/svg%3E\")";link.style.backgroundRepeat='no-repeat';link.style.backgroundPosition='8px center';link.style.backgroundSize='18px 12px';link.style.letterSpacing='.08em';link.setAttribute('aria-label','Return to the arcade');
Object.assign(link.style,{position:'fixed',bottom:'8px',right:'10px',zIndex:'100',font:'11px system-ui,sans-serif',color:'#f6e8bb',background:'#14181af0',padding:'8px 12px 8px 30px',border:'1px solid #e6b84766',borderRadius:'5px',textDecoration:'none',boxShadow:'0 2px 8px #0003'});
if(location.pathname.includes('burger-tycoon'))link.style.bottom='76px';
link.addEventListener('keydown',event=>event.stopPropagation());
document.body.append(link);

})();
