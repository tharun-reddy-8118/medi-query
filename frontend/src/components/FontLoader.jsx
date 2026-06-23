const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { width: 100%; min-height: 100vh; margin: 0; padding: 0; }
    @keyframes floatUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes bounce   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes dotPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.5);opacity:0.35} }
    @keyframes wiggle   { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
    .f0{animation:floatUp .42s ease both}
    .f1{animation:floatUp .42s .08s ease both}
    .f2{animation:floatUp .42s .16s ease both}
    .f3{animation:floatUp .42s .24s ease both}
    .f4{animation:floatUp .42s .32s ease both}
    .bounce-icon{animation:bounce 2.8s ease infinite}
    .wiggle{animation:wiggle 1.8s ease infinite}
  `}</style>
);

export default FontLoader;