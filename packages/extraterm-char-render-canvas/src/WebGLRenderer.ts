/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { mat4, vec3 } from "gl-matrix";

import { CharCellGrid, FLAG_MASK_LIGATURE, FLAG_MASK_WIDTH, FLAG_WIDTH_SHIFT, FLAG_MASK_EXTRA_FONT, STYLE_MASK_CURSOR, STYLE_MASK_INVISIBLE, STYLE_MASK_FAINT } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { TextureFontAtlas } from "./font_atlas/TextureFontAtlas";
import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics";


export class WebGLRenderer {
  private _log: Logger = null;

  private _fontAtlas: TextureFontAtlas = null;
  private _metrics: MonospaceFontMetrics = null;
  private _gridRows: number;
  private _gridColumns: number;
  private _canvas: HTMLCanvasElement = null;
  private _glContext: WebGLRenderingContext = null;
  private _indexBuffer: WebGLBuffer = null;
  private _textureCoordBuffer: WebGLBuffer = null;
  private _vertexPositionBuffer: WebGLBuffer = null;

  private _shaderProgram: WebGLProgram;
  private _vertexPosition: number;
  private _textureCoord: number;
  private _projectionMatrixLocation: WebGLUniformLocation;
  private _modelViewMatrixLocation: WebGLUniformLocation;
  private _uSamplerLocation: WebGLUniformLocation;
  private _projectionMatrix: mat4;
  private _modelViewMatrix: mat4;

  // Vertex shader program
  private _vertexShaderSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  // Fragment shader program
  private _fragmentShaderSource = `
    varying highp vec2 vTextureCoord;

    uniform sampler2D uSampler;

    void main(void) {
      gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
  `;

  constructor(fontAtlas: TextureFontAtlas, public maxWidth: number, public maxHeight: number) {
    this._log = getLogger();
    this._fontAtlas = fontAtlas;
    this._metrics = this._fontAtlas.getMetrics();

    this._gridRows = Math.floor(maxHeight / this._metrics.heightPx);
    this._gridColumns = Math.floor(maxWidth / this._metrics.widthPx);
  }

  init(): boolean {
    this._canvas = document.createElement("canvas");
    this._canvas.width = this.maxWidth;
    this._canvas.height = this.maxHeight;
    document.body.appendChild(this._canvas);

    this._glContext = this._canvas.getContext("webgl");

    // If we don't have a GL context, give up now
    if (!this._glContext) {
      this._log.warn("Unable to initialize WebGL. Your browser or machine may not support it.");
      return false;
    }

    this._shaderProgram = this._initShaderProgram(this._glContext, this._vertexShaderSource,
      this._fragmentShaderSource);
    this._vertexPosition = this._glContext.getAttribLocation(this._shaderProgram, "aVertexPosition");
    this._textureCoord = this._glContext.getAttribLocation(this._shaderProgram, "aTextureCoord");
    this._projectionMatrixLocation = this._glContext.getUniformLocation(this._shaderProgram, "uProjectionMatrix");
    this._modelViewMatrixLocation = this._glContext.getUniformLocation(this._shaderProgram, "uModelViewMatrix");
    this._uSamplerLocation = this._glContext.getUniformLocation(this._shaderProgram, "uSampler");

    this._initBuffers(this._glContext, this._fontAtlas);

    this._glContext.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    this._glContext.disable(this._glContext.DEPTH_TEST);
    this._glContext.clear(this._glContext.COLOR_BUFFER_BIT);

    const projectionMatrix = mat4.create();
    mat4.ortho(projectionMatrix, 0, this.maxWidth, 0, this.maxHeight, 0, 100);

    // Flip the image vertically so that we can keep our texture coords with 0,0
    // being top left and create y value going down the screen.
    const scaleVector = vec3.create();
    vec3.set(scaleVector, 1, -1, 1);
    mat4.scale(projectionMatrix, projectionMatrix, scaleVector);
    this._projectionMatrix = projectionMatrix;

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, -this.maxHeight, -1.0]);
    this._modelViewMatrix = modelViewMatrix;

    return true;
  }

  // Initialize a shader program, so WebGL knows how to draw our data
  private _initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
    const vertexShader = this._loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this._loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      this._log.warn("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

  // creates a shader of the given type, uploads the source and
  // compiles it.
  //
  private _loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      this._log.warn("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private _initBuffers(gl: WebGLRenderingContext, atlas: TextureFontAtlas): void {
    this._vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer);
    const vertexPositions = this._gridVertexPositions(this._gridRows, this._gridColumns);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);

    this._textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureCoordBuffer);
    const textureCoordinates = this._gridTexturePositions(this._gridRows, this._gridColumns, atlas);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    const indices = this._gridIndexes(this._gridRows, this._gridColumns);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  private _gridVertexPositions(rows: number, columns: number): number[] {
    const result: number[] = [];

    const boxScale = 1; // 1.0 is normal, 0.9 is useful for debugging to get a grid effect.

    for (let j=0; j<rows; j++) {
      for (let i=0; i<columns; i++) {
        const x = i * this._metrics.widthPx;
        const x2 = (i+boxScale) * this._metrics.widthPx;
        const y = j * this._metrics.heightPx;
        const y2 = (j+boxScale) * this._metrics.heightPx;

        result.push(x);
        result.push(y);
        result.push(1.0); // Z

        result.push(x);
        result.push(y2);
        result.push(1.0); // Z

        result.push(x2);
        result.push(y2);
        result.push(1.0); // Z

        result.push(x2);
        result.push(y);
        result.push(1.0); // Z
      }
    }
    return result;
  }

  private _gridIndexes(rows: number, columns: number): number [] {
    const result: number[] = [];

    for (let i=0; i < rows*columns; i++) {
      const i4 = i * 4;
      result.push(i4);
      result.push(i4 + 1);
      result.push(i4 + 2);

      result.push(i4);
      result.push(i4 + 2);
      result.push(i4 + 3);
    }
    return result;
  }

  private _gridTexturePositions(rows: number, columns: number, atlas: TextureFontAtlas): number[] {
    const result: number[] = [];

    const s = "Extraterm WebGL. ";
    let c = 0;

    for (let j=0; j<=rows; j++) {
      for (let i=0; i<=columns; i++) {
        const coord = atlas.loadCodePoint(s.codePointAt(c % s.length), 0, 0xffffffff, 0x000000ff);
        const xPixels = coord.textureXpx;
        const yPixels = coord.textureYpx;
        const x2Pixels = coord.textureX2px;
        const y2Pixels = coord.textureY2px;

        result.push(xPixels);
        result.push(yPixels);

        result.push(xPixels);
        result.push(y2Pixels);

        result.push(x2Pixels);
        result.push(y2Pixels);

        result.push(x2Pixels);
        result.push(yPixels);

        c++;
      }
    }
    return result;
  }

  // Initialize a texture and load an image.
  // When the image finished loading copy it into the texture.
  //
  private _loadAtlasTexture(gl: WebGLRenderingContext, atlasCanvas: HTMLCanvasElement): WebGLTexture {
    const texture = gl.createTexture();

    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, atlasCanvas);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(atlasCanvas.width) && isPowerOf2(atlasCanvas.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn off mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    return texture;
  }

  render( /*cellGrid: CharCellGrid, firstRow: number, rowCount: number, destinationCanvas */): void {

    const texture = this._loadAtlasTexture(this._glContext, this._fontAtlas.getCanvas());

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 3;
      const type = this._glContext.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this._glContext.bindBuffer(this._glContext.ARRAY_BUFFER, this._vertexPositionBuffer);
      this._glContext.vertexAttribPointer(
          this._vertexPosition,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      this._glContext.enableVertexAttribArray(this._vertexPosition);
    }

    // Tell WebGL how to pull out the texture coordinates from
    // the texture coordinate buffer into the textureCoord attribute.
    {
      const numComponents = 2;
      const type = this._glContext.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this._glContext.bindBuffer(this._glContext.ARRAY_BUFFER, this._textureCoordBuffer);
      this._glContext.vertexAttribPointer(
          this._textureCoord,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      this._glContext.enableVertexAttribArray(this._textureCoord);
    }

    this._glContext.bindBuffer(this._glContext.ELEMENT_ARRAY_BUFFER, this._indexBuffer);

    this._glContext.useProgram(this._shaderProgram);

    this._glContext.uniformMatrix4fv(
        this._projectionMatrixLocation,
        false,
        this._projectionMatrix);
    this._glContext.uniformMatrix4fv(
        this._modelViewMatrixLocation,
        false,
        this._modelViewMatrix);

    this._glContext.activeTexture(this._glContext.TEXTURE0);
    this._glContext.bindTexture(this._glContext.TEXTURE_2D, texture);
    this._glContext.uniform1i(this._uSamplerLocation, 0);

    {
      const vertexCount = 6 * this._gridRows * this._gridColumns;
      const type = this._glContext.UNSIGNED_SHORT;
      const offset = 0;
      this._glContext.drawElements(this._glContext.TRIANGLES, vertexCount, type, offset);
    }

  }
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}
