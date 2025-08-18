/*
	Installed from https://reactbits.dev/default/
*/

import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import "./Aurora.css";

// Modified to use WebGL 1.0 syntax
const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Modified to use WebGL 1.0 syntax
const FRAG = `
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Struct implementation - replaced with simpler logic for WebGL 1.0
// Simpler color ramp implementation
vec3 getRampColor(float factor) {
  if (factor < 0.5) {
    float localFactor = factor / 0.5;
    return mix(uColorStops[0], uColorStops[1], localFactor);
  } else {
    float localFactor = (factor - 0.5) / 0.5;
    return mix(uColorStops[1], uColorStops[2], localFactor);
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  // Get color from color ramp
  vec3 rampColor = getRampColor(uv.x);
  
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  // midPoint is fixed; uBlend controls the transition width.
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  
  // Make colors more vibrant
  auroraColor = pow(auroraColor, vec3(0.8));
  
  // Set fragment color with alpha
  gl_FragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

export default function Aurora(props) {
  const {
    colorStops = ["#0ff", "#0f0", "#f0f"],
    amplitude = 1.0,
    blend = 0.5,
    speed = 1.0,
    time = 0
  } = props;
  
  const propsRef = useRef(props);
  propsRef.current = props;

  const ctnDom = useRef(null);
  const animateIdRef = useRef(null);
  const glCanvasRef = useRef(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    console.log("Aurora: Initializing renderer");
    
    try {
      // Create renderer with proper settings for visibility
      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        powerPreference: "high-performance",
        depth: false,
        webgl: 1, // Force WebGL 1.0
      });
      
      const gl = renderer.gl;
      
      // Store the canvas reference
      glCanvasRef.current = gl.canvas;
      
      // Configure GL context
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      
      // Add custom canvas styling
      gl.canvas.style.position = "absolute";
      gl.canvas.style.top = "0";
      gl.canvas.style.left = "0";
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      gl.canvas.style.backgroundColor = "transparent";
      gl.canvas.style.zIndex = "0";
      
      console.log("WebGL Renderer Info:", gl.getParameter(gl.RENDERER));
      console.log("WebGL Version:", gl.getParameter(gl.VERSION));

      let program;

      function resize() {
        if (!ctn) return;
        
        const width = ctn.offsetWidth || window.innerWidth;
        const height = ctn.offsetHeight || window.innerHeight;
        
        console.log("Aurora: Resizing to", width, "x", height);
        
        renderer.setSize(width, height);
        
        if (program) {
          program.uniforms.uResolution.value = [width, height];
        }
      }
      
      window.addEventListener("resize", resize);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) {
        delete geometry.attributes.uv;
      }

      const colorStopsArray = colorStops.map((hex) => {
        const c = new Color(hex);
        return [c.r, c.g, c.b];
      });

      program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: time || 0 },
          uAmplitude: { value: amplitude },
          uColorStops: { value: colorStopsArray },
          uResolution: { value: [ctn.offsetWidth || window.innerWidth, ctn.offsetHeight || window.innerHeight] },
          uBlend: { value: blend },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });
      
      // Append canvas to container
      ctn.appendChild(gl.canvas);
      
      console.log("Aurora: Initialization complete, starting animation");

      const update = (t) => {
        animateIdRef.current = requestAnimationFrame(update);
        
        const currentProps = propsRef.current;
        const currentTime = currentProps.time || t * 0.01;
        const currentSpeed = currentProps.speed || speed || 1.0;
        
        program.uniforms.uTime.value = currentTime * currentSpeed * 0.1;
        program.uniforms.uAmplitude.value = currentProps.amplitude ?? amplitude;
        program.uniforms.uBlend.value = currentProps.blend ?? blend;
        
        const stops = currentProps.colorStops ?? colorStops;
        program.uniforms.uColorStops.value = stops.map((hex) => {
          const c = new Color(hex);
          return [c.r, c.g, c.b];
        });
        
        renderer.render({ scene: mesh });
      };
      
      // Start animation loop immediately
      animateIdRef.current = requestAnimationFrame(update);
      
      // Initial resize
      resize();

      return () => {
        console.log("Aurora: Cleaning up");
        
        if (animateIdRef.current) {
          cancelAnimationFrame(animateIdRef.current);
        }
        
        window.removeEventListener("resize", resize);
        
        if (ctn && gl.canvas.parentNode === ctn) {
          ctn.removeChild(gl.canvas);
        }
        
        // Clean up WebGL context to prevent memory leaks
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch (err) {
      console.error("Aurora initialization error:", err);
      return () => {}; // Empty cleanup function in case of error
    }
  }, [amplitude, colorStops, blend, speed, time]);

  return <div ref={ctnDom} className="aurora-container" />;
}
