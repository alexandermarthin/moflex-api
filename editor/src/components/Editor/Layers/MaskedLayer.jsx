// MaskedLayer.jsx
import * as THREE from "three";
import { useThree, createPortal } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Props:
 *  - width, height: comp/layer size i pixels
 *  - mode: 'alpha' | 'luma'
 *  - invert: boolean
 *  - children: content der skal maskes (renderes til colorRT)
 *  - mask: mask geometry (renderes til maskRT som hvid på sort)
 */
export default function MaskedLayer({
    width,
    height,
    mode = "alpha",
    invert = false,
    children,
    mask,
    // z, transform osv. styres udenom via wrapper <group> (se integration nedenfor)
}) {
    const gl = useThree((s) => s.gl);

    // --- Render targets using WebGLRenderTarget directly for proper MSAA
    const colorRT = useMemo(() => {
        const rt = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });
        rt.texture.colorSpace = THREE.NoColorSpace;
        return rt;
    }, [width, height]);

    const maskRT = useMemo(() => {
        const rt = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });
        rt.texture.colorSpace = THREE.NoColorSpace;
        return rt;
    }, [width, height]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            colorRT.dispose();
            maskRT.dispose();
        };
    }, [colorRT, maskRT]);

    // --- Scener + ortho-kamera i pixelspace
    const contentScene = useMemo(() => new THREE.Scene(), []);
    const maskScene = useMemo(() => new THREE.Scene(), []);

    const cam = useMemo(() => {
        // Ortho-kamera i pixelspace: (0,0) nederst venstre → (width,height) øverst højre
        const c = new THREE.OrthographicCamera(0, width, 0, height, 0.1, 1000);
        c.position.set(0, 0, 10);
        c.updateProjectionMatrix();
        return c;
    }, [width, height]);

    // --- Fullscreen quad i hovedscenen, der kompositér RT'erne
    const matRef = useRef();

    const shaderMat = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                tColor: { value: colorRT.texture },
                tMask: { value: maskRT.texture },
                uMode: { value: mode === "luma" ? 1 : 0 },
                uInvert: { value: invert ? 1 : 0 },
                uPixelSize: { value: new THREE.Vector2(1.0 / width, 1.0 / height) },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            toneMapped: false,
            premultipliedAlpha: false,
            vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
            fragmentShader: `
        #include <common>
        uniform sampler2D tColor;
        uniform sampler2D tMask;
        uniform int uMode;   // 0=alpha, 1=luma
        uniform int uInvert; // 0=normal, 1=invert
        uniform vec2 uPixelSize;
        varying vec2 vUv;

        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        
        float getMaskValue(vec2 uv) {
          vec4 s = texture2D(tMask, uv);
          return uMode == 1 ? luma(s.rgb) : s.a;
        }

        void main(){
          vec4 col = texture2D(tColor, vUv);
          
          // Soft edge blur for antialiasing (1.5 pixel radius)
          vec2 blur = uPixelSize * 1.5;
          float m = 0.0;
          m += getMaskValue(vUv + vec2(-blur.x, -blur.y)) * 0.0625;
          m += getMaskValue(vUv + vec2(0.0, -blur.y)) * 0.125;
          m += getMaskValue(vUv + vec2(blur.x, -blur.y)) * 0.0625;
          m += getMaskValue(vUv + vec2(-blur.x, 0.0)) * 0.125;
          m += getMaskValue(vUv) * 0.25;
          m += getMaskValue(vUv + vec2(blur.x, 0.0)) * 0.125;
          m += getMaskValue(vUv + vec2(-blur.x, blur.y)) * 0.0625;
          m += getMaskValue(vUv + vec2(0.0, blur.y)) * 0.125;
          m += getMaskValue(vUv + vec2(blur.x, blur.y)) * 0.0625;
          
          if(uInvert == 1) m = 1.0 - m;

          // Apply mask to alpha only, keep RGB unchanged
          gl_FragColor = vec4(col.rgb, col.a * m);
          #include <colorspace_fragment>
        }
      `,
        });
    }, [colorRT, maskRT, mode, invert, width, height]);

    // --- Render loops (childrens portals lever i subscener)
    useFrame(() => {
        // Render CONTENT til colorRT
        const prevRT = gl.getRenderTarget();
        gl.setRenderTarget(colorRT);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(contentScene, cam);

        // Render MASK
        gl.setRenderTarget(maskRT);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(maskScene, cam);

        gl.setRenderTarget(prevRT);
        // Sørg for at shaderen ser de nyeste teksturer
        matRef.current && (matRef.current.uniforms.tColor.value = colorRT.texture);
        matRef.current && (matRef.current.uniforms.tMask.value = maskRT.texture);
    });

    return (
        <>
            {/* Portals: render children & mask i deres egne scener i pixelspace */}
            {createPortal(
                // Indhold skal typisk være placeret med samme pixelspace-koords.
                // Eksempel: et plan centreret i (width/2, height/2) i local space.
                <group>{children}</group>,
                contentScene
            )}
            {createPortal(
                // Masken skal tegnes i HVID på SORT. Brug meshBasicMaterial color="white".
                <group>{mask}</group>,
                maskScene
            )}

            {/* Komposit-output i hovedscenen: et plan i lagets størrelse */}
            <mesh position={[width / 2, height / 2, 0]} scale={[1, -1, 1]}>
                <planeGeometry args={[width, height]} />
                <primitive object={shaderMat} attach="material" ref={matRef} />
            </mesh>
        </>
    );
}
