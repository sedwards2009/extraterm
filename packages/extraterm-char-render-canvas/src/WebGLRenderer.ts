/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { mat4, vec3 } from "gl-matrix";

import { CharCellGrid, STYLE_MASK_CURSOR, STYLE_MASK_INVERSE } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { TextureFontAtlas, TextureCachedGlyph } from "./font_atlas/TextureFontAtlas";
import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics";
import { normalizedCellIterator } from "./NormalizedCellIterator";


const CANVAS_SIZE_STEP = 512;

export class WebGLRenderer {
  private _log: Logger = null;

  private _metrics: MonospaceFontMetrics = null;
  private _canvas: HTMLCanvasElement = null;
  private _glContext: WebGL2RenderingContext = null;
  private _triangleIndexBuffer: WebGLBuffer = null;
  private _textureCoordBuffer: WebGLBuffer = null;
  private _vertexPositionBuffer: WebGLBuffer = null;
  private _texture: WebGLTexture;
  private _shaderProgram: WebGLProgram;

  private _vertexPositionAttrib: number;
  private _textureCoordAttrib: number;
  private _glyphTexturetPositionAttrib: number;
  private _cellPositionAttrib: number;

  private _projectionMatrixLocation: WebGLUniformLocation;
  private _modelViewMatrixLocation: WebGLUniformLocation;
  private _uSamplerLocation: WebGLUniformLocation;
  private _projectionMatrix: mat4;
  private _modelViewMatrix: mat4;

  private _renderBlockCursor = false;
  private _cursorColor = 0xff;

  // Vertex shader program
  private _vertexShaderSource = `#version 300 es
    in vec4 aVertexPosition;
    in vec2 aTextureCoord;

    in vec2 cellPosition;
    in vec2 glyphTexturePosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    out highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * (aVertexPosition + vec4(cellPosition, 0, 0));
      vTextureCoord = aTextureCoord + glyphTexturePosition;
    }
  `;

  // Fragment shader program
  private _fragmentShaderSource = `#version 300 es
    in highp vec2 vTextureCoord;

    uniform sampler2D uSampler;

    out highp vec4 fragColor;

    void main(void) {
      fragColor = texture(uSampler, vTextureCoord);
    }
  `;

  constructor(private _fontAtlas: TextureFontAtlas, private _transparentBackground: boolean) {
    this._log = getLogger("WebGLRenderer", this);
    this._metrics = this._fontAtlas.getMetrics();
  }

  init(): boolean {
    this._canvas = document.createElement("canvas");

    const gl = this._canvas.getContext("webgl2", {alpha: this._transparentBackground, premultipliedAlpha: false});
    this._glContext = gl;

    // If we don't have a GL context, give up now
    if (gl == null) {
      this._log.warn("Unable to initialize WebGL. Your browser or machine may not support it.");
      return false;
    }

    this._shaderProgram = this._initShaderProgram(gl, this._vertexShaderSource,
      this._fragmentShaderSource);
    this._vertexPositionAttrib = gl.getAttribLocation(this._shaderProgram, "aVertexPosition");
    this._textureCoordAttrib = gl.getAttribLocation(this._shaderProgram, "aTextureCoord");
    this._glyphTexturetPositionAttrib = this._glContext.getAttribLocation(this._shaderProgram, "glyphTexturePosition");
    this._cellPositionAttrib = this._glContext.getAttribLocation(this._shaderProgram, "cellPosition");
    this._projectionMatrixLocation = gl.getUniformLocation(this._shaderProgram, "uProjectionMatrix");
    this._modelViewMatrixLocation = gl.getUniformLocation(this._shaderProgram, "uModelViewMatrix");
    this._uSamplerLocation = gl.getUniformLocation(this._shaderProgram, "uSampler");

    gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);
    gl.clearColor(0.0, 0.0, 0.0, this._transparentBackground ? 0.0 : 1.0);  // Clear to black
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this._shaderProgram);
    gl.uniform1i(this._uSamplerLocation, 0);

    this._setupProjections();
    this._initVertexPositionBuffer(this._glContext);
    this._initTemplateTexturePositions(this._glContext, this._fontAtlas.getTextureCellWidth(),
      this._fontAtlas.getTextureCellHeight());
    this._initTemplateMeshIndexes(this._glContext);
    this._resizeCanvas(1, 1);

    this._texture = gl.createTexture();

    return true;
  }

  setRenderBlockCursor(on: boolean): void {
    this._renderBlockCursor = on;
  }

  setCursorColor(color: number): void {
    this._cursorColor = color;
  }

  getFontAtlas(): TextureFontAtlas {
    return this._fontAtlas;
  }

  getFontMetrics(): MonospaceFontMetrics {
    return this._fontAtlas.getMetrics();
  }

  // Initialize a shader program, so WebGL knows how to draw our data
  private _initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
    const vertexShader = this._loadShader(gl, gl.VERTEX_SHADER, "VERTEX_SHADER", vsSource);
    const fragmentShader = this._loadShader(gl, gl.FRAGMENT_SHADER, "FRAGMENT_SHADER", fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if ( ! gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      this._log.warn(`Unable to link the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
      return null;
    }

    return shaderProgram;
  }

  private _setupProjections(): void {
    const canvasWidth = this._canvas.width;
    const canvasHeight = this._canvas.height;

    const gl = this._glContext;
    gl.useProgram(this._shaderProgram);

    gl.viewport(0, 0, canvasWidth, canvasHeight);

    const projectionMatrix = mat4.create();
    mat4.ortho(projectionMatrix, 0, canvasWidth, 0, canvasHeight, 0, 100);

    // Flip the image vertically so that we can keep our texture coords with 0,0
    // being top left and create y value going down the screen.
    const scaleVector = vec3.create();
    vec3.set(scaleVector, 1, -1, 1);
    mat4.scale(projectionMatrix, projectionMatrix, scaleVector);
    this._projectionMatrix = projectionMatrix;

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, -canvasHeight, -1.0]);
    this._modelViewMatrix = modelViewMatrix;

    gl.uniformMatrix4fv(this._projectionMatrixLocation, false, this._projectionMatrix);
    gl.uniformMatrix4fv(this._modelViewMatrixLocation, false, this._modelViewMatrix);
  }

  private _resizeCanvas(minWidth: number, minHeight: number): void {
    let changed = false;
    if (this._canvas.width < minWidth) {
      this._canvas.width = (Math.floor(minWidth / CANVAS_SIZE_STEP) + 1) * CANVAS_SIZE_STEP;
      changed = true;
    }
    if (this._canvas.height < minHeight) {
      this._canvas.height = (Math.floor(minHeight / CANVAS_SIZE_STEP) + 1) * CANVAS_SIZE_STEP;
      changed = true;
    }
    if ( ! changed) {
      return;
    }

    this._setupProjections();
  }

  // creates a shader of the given type, uploads the source and
  // compiles it.
  //
  private _loadShader(gl: WebGLRenderingContext, type: number, shaderName: string, source: string): WebGLShader {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if ( ! gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      this._log.warn(`An error occurred compiling the shader ${shaderName}: ${gl.getShaderInfoLog(shader)}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private _initTemplateTexturePositions(gl: WebGLRenderingContext, cellWidthPx: number, cellHeightPx: number): void {
    this._textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureCoordBuffer);
    const textureCoordinates = this._templateTexturePositions(cellWidthPx, cellHeightPx);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

    // Tell WebGL how to pull out the texture coordinates from
    // the texture coordinate buffer into the textureCoord attribute.
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(this._textureCoordAttrib, numComponents, type, normalize, stride, offset);
    gl.enableVertexAttribArray(this._textureCoordAttrib);
  }

  private _initTemplateMeshIndexes(gl: WebGLRenderingContext): void {
    this._triangleIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._triangleIndexBuffer);
    const indices = this._templateTriangleIndexes();
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  private _initVertexPositionBuffer(gl: WebGLRenderingContext): void {
    this._vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer);
    const vertexPositions = this._templateVertexPositions();
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    const numComponents = 3;
    const type = this._glContext.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    this._glContext.bindBuffer(this._glContext.ARRAY_BUFFER, this._vertexPositionBuffer);
    this._glContext.vertexAttribPointer(this._vertexPositionAttrib, numComponents, type, normalize, stride, offset);
    this._glContext.enableVertexAttribArray(this._vertexPositionAttrib);
  }

  private _templateVertexPositions(): number[] {
    const result: number[] = [];

    const boxScale = 1; // 1.0 is normal, 0.9 is useful for debugging to get a grid effect.
    const x = 0;
    const x2 = boxScale * this._metrics.widthPx;
    const y = 0;
    const y2 = boxScale * this._metrics.heightPx;

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
    return result;
  }

  private _templateTriangleIndexes(): number [] {
    return [0, 1, 2, 0, 2, 3];
  }

  private _templateTexturePositions(cellWidthPx: number, cellHeightPx: number): number[] {
    const result: number[] = [];
    const xPixels = 0;
    const yPixels = 0;
    const x2Pixels = cellWidthPx;
    const y2Pixels = cellHeightPx;

    result.push(xPixels);
    result.push(yPixels);

    result.push(xPixels);
    result.push(y2Pixels);

    result.push(x2Pixels);
    result.push(y2Pixels);

    result.push(x2Pixels);
    result.push(yPixels);

    return result;
  }


  private _gridTexturePositions(cellGrid: CharCellGrid, atlas: TextureFontAtlas): number[] {
    const result: number[] = [];
    const textureCellWidth = atlas.getTextureCellWidth();
    const renderCursor = this._renderBlockCursor;

    for (let j=0; j<cellGrid.height; j++) {
      for (const normalizedCell of normalizedCellIterator(cellGrid, j)) {
        const codePoint = normalizedCell.codePoint;
        const fontIndex = normalizedCell.extraFontFlag ? 1 : 0;
        const x = normalizedCell.x;

        let fgRGBA = cellGrid.getFgRGBA(x, j);
        let bgRGBA = cellGrid.getBgRGBA(x, j);

        const style = cellGrid.getStyle(x, j);
        if ((style & STYLE_MASK_CURSOR) && renderCursor) {
          fgRGBA = bgRGBA;
          bgRGBA = this._cursorColor;
        } else {
          if (style & STYLE_MASK_INVERSE) {
            const tmp = fgRGBA;
            fgRGBA = bgRGBA;
            bgRGBA = tmp;
          }
        }

        let coord: TextureCachedGlyph = null;
        if (normalizedCell.isLigature) {
          coord = atlas.loadCombiningCodePoints(normalizedCell.ligatureCodePoints, cellGrid.getStyle(x, j),
            fontIndex, fgRGBA, bgRGBA);
        } else {
          coord = atlas.loadCodePoint(codePoint, cellGrid.getStyle(x, j), fontIndex, fgRGBA, bgRGBA);
        }

        result.push(coord.textureXpx + normalizedCell.segment * textureCellWidth);
        result.push(coord.textureYpx);
      }
    }
    return result;
  }

  // Initialize a texture and load an image.
  // When the image finished loading copy it into the texture.
  //
  private _loadAtlasTexture(gl: WebGLRenderingContext, atlasCanvas: HTMLCanvasElement): WebGLTexture {
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, this._texture);
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

    return this._texture;
  }

  render(destinationContext: CanvasRenderingContext2D, cellGrid: CharCellGrid, firstRow: number,
      rowCount: number): void {

    const rectWidth = this._metrics.widthPx * cellGrid.width;
    const rectHeight = this._metrics.heightPx * cellGrid.height;
    this._resizeCanvas(rectWidth, rectHeight);

    this._setupTexturePositions(cellGrid);

    const texture = this._loadAtlasTexture(this._glContext, this._fontAtlas.getCanvas());
    this._glContext.activeTexture(this._glContext.TEXTURE0);
    this._glContext.bindTexture(this._glContext.TEXTURE_2D, texture);

    this._setupCellGridVertexes(cellGrid);

    this._glContext.drawElementsInstanced(this._glContext.TRIANGLES, 6, this._glContext.UNSIGNED_SHORT, 0,
      cellGrid.width * cellGrid.height);

    if (destinationContext == null) {
      return;
    }

    if (this._transparentBackground) {
      destinationContext.clearRect(0, 0, rectWidth, rectHeight);
    }

    destinationContext.drawImage(this._canvas, 0, 0, rectWidth, rectHeight, 0, 0, rectWidth, rectHeight);
  }

  private _setupTexturePositions(cellGrid: CharCellGrid): void {
    const glyphTexturePositionBuffer = this._glContext.createBuffer();
    this._glContext.bindBuffer(this._glContext.ARRAY_BUFFER, glyphTexturePositionBuffer);
    const glyphPositionArray = this._gridTexturePositions(cellGrid, this._fontAtlas);
    this._glContext.bufferData(this._glContext.ARRAY_BUFFER, new Float32Array(glyphPositionArray),
      this._glContext.STATIC_DRAW);

    const numComponents = 2;
    const type = this._glContext.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    this._glContext.vertexAttribPointer(this._glyphTexturetPositionAttrib, numComponents, type, normalize, stride,
      offset);
    this._glContext.vertexAttribDivisor(this._glyphTexturetPositionAttrib, 1);
    this._glContext.enableVertexAttribArray(this._glyphTexturetPositionAttrib);
  }

  private _setupCellGridVertexes(cellGrid: CharCellGrid): void {
    const numComponents = 2;
    const type = this._glContext.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;

    const cellGridVertexBuffer = this._glContext.createBuffer();
    this._glContext.bindBuffer(this._glContext.ARRAY_BUFFER, cellGridVertexBuffer);

    const cellGridVertexArray = this._cellGridVertexTopLeft(cellGrid);
    this._glContext.bufferData(this._glContext.ARRAY_BUFFER, new Float32Array(cellGridVertexArray),
      this._glContext.STATIC_DRAW);

    this._glContext.vertexAttribPointer(this._cellPositionAttrib, numComponents, type, normalize, stride, offset);
    this._glContext.vertexAttribDivisor(this._cellPositionAttrib, 1);
    this._glContext.enableVertexAttribArray(this._cellPositionAttrib);
  }

  private _cellGridVertexTopLeft(cellGrid: CharCellGrid): number[] {
    const result: number[] = [];
    for (let j=0; j<cellGrid.height; j++) {
      for (let i=0; i<cellGrid.width; i++) {
        result.push(i * this._metrics.widthPx);
        result.push(j * this._metrics.heightPx);
      }
    }
    return result;
  }
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}
