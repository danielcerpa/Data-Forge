import React, { useEffect, useRef } from 'react';

export default function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic Theme Detection
    let isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Nord Palette Color Swatches:
    // Light Mode: High-contrast Polar Night darks + Steel/Frost accents on crisp light background
    const lightNordColors = [
      '#2E3440', // nord0: Polar Night Dark
      '#3B4252', // nord1: Polar Night Medium
      '#434C5E', // nord2: Polar Night
      '#4C566A', // nord3: Polar Steel
      '#5E81AC', // nord10: Steel Frost Blue
      '#81A1C1'  // nord9: Deep Frost Blue
    ];

    // Dark Mode: Luminous Frost Cyan / Teal / Snow / Aurora accents on dark background
    const darkNordColors = [
      '#88C0D0', // nord8: Frost Ice Cyan
      '#8FBCBB', // nord7: Frost Teal
      '#81A1C1', // nord9: Frost Blue
      '#5E81AC', // nord10: Steel Blue
      '#A3BE8C', // nord14: Aurora Green
      '#ECEFF4'  // nord6: Snow Storm
    ];

    const getPalette = () => (isDark ? darkNordColors : lightNordColors);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initDataCloud();
    };

    window.addEventListener('resize', handleResize);

    // Data vocabulary: CSV headers, data cells, types, and values
    const dataItems = [
      { text: 'id: 8402', type: 'cell' },
      { text: 'status: VALID', type: 'pill' },
      { text: 'dataset.csv', type: 'badge' },
      { text: 'rows: 10,240', type: 'cell' },
      { text: 'UTF-8', type: 'tag' },
      { text: 'schema', type: 'code' },
      { text: 'SELECT * FROM data', type: 'sql' },
      { text: '0x4F9B', type: 'hex' },
      { text: 'integrity: 99.8%', type: 'pill' },
      { text: 'hash: 8fbcbb', type: 'cell' },
      { text: 'FORGE', type: 'brand' },
      { text: '{ "clean": true }', type: 'json' },
      { text: 'column_name', type: 'code' },
      { text: '.xlsx', type: 'badge' },
      { text: 'timestamp', type: 'code' },
      { text: 'NULL', type: 'null' },
      { text: 'INDEX(id)', type: 'sql' },
      { text: '1', type: 'bit' },
      { text: '0', type: 'bit' },
      { text: '[ 12 | OK ]', type: 'grid' },
      { text: 'primary_key', type: 'code' },
      { text: 'delimiter: ","', type: 'cell' },
      { text: 'sanitized', type: 'pill' },
      { text: 'float64', type: 'type' },
      { text: 'varchar(255)', type: 'type' }
    ];

    let items = [];
    const count = Math.min(Math.floor((width * height) / 8500), 55);

    class FloatingDataItem {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        
        // Gentle, slow 360-degree ambient velocity
        const speed = Math.random() * 0.12 + 0.04;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        const dataSample = dataItems[Math.floor(Math.random() * dataItems.length)];
        this.text = dataSample.text;
        this.type = dataSample.type;
        
        const palette = getPalette();
        this.color = palette[Math.floor(Math.random() * palette.length)];
        this.fontSize = Math.floor(Math.random() * 3) + 11; // 11px to 13px
        this.alpha = isDark ? Math.random() * 0.35 + 0.15 : Math.random() * 0.4 + 0.3; // Higher opacity in light mode for crisp readability
        this.phase = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.004 + 0.002;
        this.rotation = (Math.random() - 0.5) * 0.05;
        this.rotSpeed = (Math.random() - 0.5) * 0.0005;
      }

      updateColor() {
        const palette = getPalette();
        this.color = palette[Math.floor(Math.random() * palette.length)];
        this.alpha = isDark ? Math.random() * 0.35 + 0.15 : Math.random() * 0.4 + 0.3;
      }

      update() {
        this.phase += this.speed;
        
        // Very gentle organic wave dynamics in all directions
        this.vx += Math.sin(this.phase + this.y * 0.008) * 0.004;
        this.vy += Math.cos(this.phase + this.x * 0.008) * 0.004;

        // Cap speed to keep drift ultra-smooth and slow
        const currentSpeed = Math.hypot(this.vx, this.vy);
        if (currentSpeed > 0.22) {
          this.vx = (this.vx / currentSpeed) * 0.22;
          this.vy = (this.vy / currentSpeed) * 0.22;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;

        // 360-degree boundary wrap around all 4 edges
        if (this.x < -120) this.x = width + 120;
        if (this.x > width + 120) this.x = -120;
        if (this.y < -50) this.y = height + 50;
        if (this.y > height + 50) this.y = -50;
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.alpha;
        ctx.font = `600 ${this.fontSize}px 'JetBrains Mono', monospace`;

        if (this.type === 'pill' || this.type === 'badge') {
          // Draw subtle pill / badge background frame
          const metrics = ctx.measureText(this.text);
          const paddingX = 8;
          const paddingY = 4;
          const w = metrics.width + paddingX * 2;
          const h = this.fontSize + paddingY * 2;

          ctx.fillStyle = isDark ? 'rgba(67, 76, 94, 0.45)' : 'rgba(216, 222, 233, 0.75)';
          ctx.strokeStyle = isDark ? this.color : 'rgba(76, 86, 106, 0.4)';
          ctx.lineWidth = 0.8;
          
          ctx.beginPath();
          ctx.roundRect(-paddingX, -h + paddingY + 2, w, h, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = this.color;
          ctx.fillText(this.text, 0, 0);
        } else if (this.type === 'grid') {
          // Mini data grid cell box
          const metrics = ctx.measureText(this.text);
          ctx.fillStyle = isDark ? 'rgba(46, 52, 64, 0.4)' : 'rgba(235, 238, 244, 0.8)';
          ctx.fillRect(-6, -14, metrics.width + 12, 20);
          ctx.strokeStyle = isDark ? 'rgba(136, 192, 208, 0.3)' : 'rgba(76, 86, 106, 0.35)';
          ctx.strokeRect(-6, -14, metrics.width + 12, 20);
          
          ctx.fillStyle = this.color;
          ctx.fillText(this.text, 0, 0);
        } else {
          // Plain data code / text
          ctx.fillStyle = this.color;
          ctx.fillText(this.text, 0, 0);
        }

        ctx.restore();
      }
    }

    const initDataCloud = () => {
      items = [];
      for (let i = 0; i < count; i++) {
        items.push(new FloatingDataItem());
      }
    };

    initDataCloud();

    // Listen to data-theme attribute mutations on html tag
    const observer = new MutationObserver(() => {
      const newIsDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (newIsDark !== isDark) {
        isDark = newIsDark;
        items.forEach(item => item.updateColor());
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Render loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < items.length; i++) {
        items[i].update();
        items[i].draw();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
