import * as THREE from "three";
import { getEffectPlugin } from "./registry";

// Minimal EffectRunner: ping-pong between two RTs and run registered plugins in order.
export class EffectRunner {
    constructor(gl, width, height) {
        this.gl = gl;
        this.size = { width, height };
        this._initFBOs();
        this._initQuad();
    }

    dispose() {
        this.ping?.dispose?.();
        this.pong?.dispose?.();
        this.quadGeo?.dispose?.();
        // Materials are owned by plugins; they manage their own lifecycle.
    }

    setSize(width, height) {
        if (this.size.width === width && this.size.height === height) return;
        this.size = { width, height };
        this._initFBOs(true);
    }

    _initFBOs(recreate = false) {
        const { width, height } = this.size;
        const rtOpts = {
            width,
            height,
            depthBuffer: false,
            stencilBuffer: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        };
        if (recreate) {
            this.ping?.dispose?.();
            this.pong?.dispose?.();
        }
        this.ping = new THREE.WebGLRenderTarget(width, height, rtOpts);
        this.pong = new THREE.WebGLRenderTarget(width, height, rtOpts);
        this.ping.texture.colorSpace = THREE.NoColorSpace;
        this.pong.texture.colorSpace = THREE.NoColorSpace;
    }

    _initQuad() {
        this.quadScene = new THREE.Scene();
        this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.quadGeo = new THREE.PlaneGeometry(2, 2);
        // Material will be swapped per pass by plugins
        this.quadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.quad = new THREE.Mesh(this.quadGeo, this.quadMat);
        this.quadScene.add(this.quad);
    }

    // Render a single full-screen pass with given material and input texture to the provided target.
    renderPass(material, inputTexture, outRT) {
        this.quad.material = material;
        // Common uniforms if present
        if (material.uniforms) {
            if (material.uniforms.uInput) material.uniforms.uInput.value = inputTexture;
            if (material.uniforms.uTexelSize) material.uniforms.uTexelSize.value.set(1.0 / this.size.width, 1.0 / this.size.height);
            if (material.uniforms.uResolution) material.uniforms.uResolution.value.set(this.size.width, this.size.height);
        }
        this.gl.setRenderTarget(outRT);
        this.gl.clear(true, true, true);
        this.gl.render(this.quadScene, this.quadCam);
        return outRT.texture;
    }

    // Run the list of effects in order. Returns the final texture.
    run({ texture, width, height, effects, time }) {
        this.setSize(width, height);
        if (!effects || effects.length === 0) return texture;
        let readTex = texture;
        let writeRT = this.ping;
        for (let i = 0; i < effects.length; i++) {
            const eff = effects[i];
            const plugin = getEffectPlugin(eff.matchName);
            if (!plugin) {
                console.warn(`[EffectRunner] Effect not found: ${eff.matchName}`);
                continue;
            }
            const resultTex = plugin.apply({
                gl: this.gl,
                runner: this,
                readTex,
                ping: this.ping,
                pong: this.pong,
                writeRT,
                size: this.size,
                effect: eff,
                time,
            });
            // Update read and choose next write target to avoid feedback
            readTex = resultTex;
            if (resultTex === this.ping.texture) {
                writeRT = this.pong;
            } else if (resultTex === this.pong.texture) {
                writeRT = this.ping;
            } else {
                writeRT = this.ping;
            }
        }
        return readTex;
    }
}

export default EffectRunner;
