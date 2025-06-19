class QuickMeme {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.originalImageWidth = 0;
    this.originalImageHeight = 0;
    this.backgroundImage = null;
    this.textObjects = [];
    this.selectedTextId = null;
    this.textCounter = 0;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeHandle = null;

    this.init();
  }

  init() {
    this.canvas = document.getElementById("memeCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.setupEventListeners();

    this.checkStoredImage();

    document.getElementById("editorText").addEventListener("input", (e) => {
      this.updateText(this.selectedTextId, "text", e.target.value);
    });

    document.getElementById("deleteTextBtn").addEventListener("click", () => {
      if (this.selectedTextId) {
        this.deleteText(this.selectedTextId);
        this.selectedTextId = null;
      }
    });

    document.getElementById("editorFontSize").addEventListener("input", (e) => {
      this.updateText(
        this.selectedTextId,
        "fontSize",
        parseInt(e.target.value)
      );
    });

    document.getElementById("editorFill").addEventListener("input", (e) => {
      this.updateText(this.selectedTextId, "fill", e.target.value);
    });

    document.getElementById("editorStroke").addEventListener("input", (e) => {
      this.updateText(this.selectedTextId, "stroke", e.target.value);
    });

    document
      .getElementById("editorFontFamily")
      .addEventListener("change", (e) => {
        this.updateText(this.selectedTextId, "fontFamily", e.target.value);
      });

    document
      .getElementById("editorStrokeWidth")
      .addEventListener("input", (e) => {
        this.updateText(
          this.selectedTextId,
          "strokeWidth",
          parseInt(e.target.value)
        );
      });
  }

  setupEventListeners() {
    document.getElementById("loadImage").addEventListener("click", () => {
      const url = document.getElementById("imageUrl").value.trim();
      if (url) {
        this.loadImage(url);
      }
    });

    document.getElementById("addText").addEventListener("click", () => {
      this.addText();
    });

    document.getElementById("downloadMeme").addEventListener("click", () => {
      this.downloadMeme();
    });

    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("click", (e) => this.onClick(e));

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  async checkStoredImage() {
    try {
      const result = await chrome.storage.local.get(["currentImageUrl"]);
      if (result.currentImageUrl) {
        document.getElementById("imageUrl").value = result.currentImageUrl;
        await this.loadImage(result.currentImageUrl);
        chrome.storage.local.remove(["currentImageUrl"]);
      } else {
        const result = await chrome.storage.local.get("quickMemeState");
        const state = result.quickMemeState;

        if (state?.imageUrl) {
          await this.loadImage(state.imageUrl);
          this.textObjects = state.textObjects || [];
          this.selectedTextId = state.selectedTextId || null;
          document.getElementById("imageUrl").value = state.imageUrl;

          this.redraw();
          if (this.selectedTextId) {
            this.selectText(this.selectedTextId);
          }
        }
      }
    } catch (error) {
      console.log("No stored image URL");
    }
  }

  async loadImage(url) {
    const loadingText = document.getElementById("loadingText");
    const canvasEl = document.getElementById("memeCanvas");

    loadingText.textContent = "Loading image...";
    canvasEl.style.display = "none";

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        this.originalImageWidth = img.width;
        this.originalImageHeight = img.height;
        this.backgroundImage = img;

        const maxWidth = 470;
        const maxHeight = 300;
        let canvasWidth = img.width;
        let canvasHeight = img.height;

        if (canvasWidth > maxWidth) {
          const ratio = maxWidth / canvasWidth;
          canvasWidth = maxWidth;
          canvasHeight = canvasHeight * ratio;
        }

        if (canvasHeight > maxHeight) {
          const ratio = maxHeight / canvasHeight;
          canvasHeight = maxHeight;
          canvasWidth = canvasWidth * ratio;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.width = canvasWidth + "px";
        this.canvas.style.height = canvasHeight + "px";

        this.redraw();

        canvasEl.style.display = "block";
        loadingText.style.display = "none";
      };

      img.onerror = () => {
        loadingText.textContent =
          "Failed to load image. Please check the URL and try again.";
      };

      img.src = url;
      this.saveState();
    } catch (error) {
      loadingText.textContent = "Error loading image: " + error.message;
    }
  }

  addText() {
    this.textCounter++;
    const textId = "text_" + this.textCounter;

    const textObj = {
      id: textId,
      text: "Your text here",
      x: 50,
      y: 50,
      fontSize: 40,
      fontFamily: "Impact, Arial Black, sans-serif",
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
      width: 200,
      height: 50,
      selected: false,
    };

    this.textObjects.push(textObj);
    this.updateTextDimensions(textObj);
    this.populateEditor(textObj);
    this.selectText(textId);
    this.redraw();
  }

  populateEditor(textObj) {
    const editor = document.getElementById("textEditor");
    editor.style.display = "block";

    document.getElementById("editorText").value = textObj.text;
    document.getElementById("editorFontSize").value = textObj.fontSize;
    document.getElementById("editorFill").value = textObj.fill;
    document.getElementById("editorStroke").value = textObj.stroke;
    document.getElementById("editorStrokeWidth").value = textObj.strokeWidth;
    document.getElementById("editorFontFamily").value = textObj.fontFamily;

    this.selectedTextId = textObj.id;
  }

  updateText(textId, property, value) {
    const textObj = this.textObjects.find((t) => t.id === textId);
    if (textObj) {
      textObj[property] = value;

      if (property === "text" || property === "fontSize") {
        this.updateTextDimensions(textObj);
      }

      this.redraw();
    }
  }

  updateTextDimensions(textObj) {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = `bold ${textObj.fontSize}px ${textObj.fontFamily}`;

    const metrics = tempCtx.measureText(textObj.text);
    textObj.width = Math.max(metrics.width + 20, 50);
    textObj.height = textObj.fontSize + 20;
  }

  selectText(textId) {
    this.textObjects.forEach((t) => (t.selected = false));

    document.querySelectorAll(".text-item").forEach((item) => {
      item.classList.remove("selected");
    });

    if (textId) {
      const textObj = this.textObjects.find((t) => t.id === textId);
      if (textObj) {
        textObj.selected = true;
      }

      const controlsElement = document.getElementById("controls_" + textId);
      if (controlsElement) {
        controlsElement.classList.add("selected");
      }
    }

    this.selectedTextId = textId;
    const textObj = this.textObjects.find((t) => t.id === textId);
    if (textObj) {
      this.populateEditor(textObj);
    } else {
      document.getElementById("textEditor").style.display = "none";
    }
    this.redraw();
  }

  deleteText(textId) {
    this.textObjects = this.textObjects.filter((t) => t.id !== textId);

    const controlsElement = document.getElementById("controls_" + textId);
    if (controlsElement) {
      controlsElement.remove();
    }

    this.selectedTextId = null;
    this.redraw();
  }

  redraw() {
    if (!this.backgroundImage) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.drawImage(
      this.backgroundImage,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.textObjects.forEach((textObj) => {
      this.drawText(textObj);
    });
    this.saveState();
  }

  drawText(textObj) {
    this.ctx.save();

    this.ctx.font = `bold ${textObj.fontSize}px ${textObj.fontFamily}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    if (textObj.strokeWidth > 0) {
      this.ctx.strokeStyle = textObj.stroke;
      this.ctx.lineWidth = textObj.strokeWidth;
      this.ctx.strokeText(
        textObj.text,
        textObj.x + textObj.width / 2,
        textObj.y + textObj.height / 2
      );
    }

    this.ctx.fillStyle = textObj.fill;
    this.ctx.fillText(
      textObj.text,
      textObj.x + textObj.width / 2,
      textObj.y + textObj.height / 2
    );

    if (textObj.selected) {
      this.ctx.strokeStyle = "#007cba";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(textObj.x, textObj.y, textObj.width, textObj.height);
      this.ctx.setLineDash([]);

      this.drawResizeHandles(textObj);
    }

    this.ctx.restore();
  }

  drawResizeHandles(textObj) {
    const handleSize = 8;
    const handles = [
      {
        x: textObj.x + textObj.width - handleSize / 2,
        y: textObj.y + textObj.height - handleSize / 2,
      },
    ];

    this.ctx.fillStyle = "#007cba";
    handles.forEach((handle) => {
      this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  getTextAt(x, y) {
    for (let i = this.textObjects.length - 1; i >= 0; i--) {
      const textObj = this.textObjects[i];
      if (
        x >= textObj.x &&
        x <= textObj.x + textObj.width &&
        y >= textObj.y &&
        y <= textObj.y + textObj.height
      ) {
        return textObj;
      }
    }
    return null;
  }

  getResizeHandle(x, y, textObj) {
    const handleSize = 8;
    const handle = {
      x: textObj.x + textObj.width - handleSize / 2,
      y: textObj.y + textObj.height - handleSize / 2,
    };

    if (
      x >= handle.x &&
      x <= handle.x + handleSize &&
      y >= handle.y &&
      y <= handle.y + handleSize
    ) {
      return "se";
    }
    return null;
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);
    const selectedText = this.textObjects.find((t) => t.selected);

    if (selectedText) {
      const handle = this.getResizeHandle(pos.x, pos.y, selectedText);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        return;
      }
    }

    const textObj = this.getTextAt(pos.x, pos.y);
    if (textObj) {
      this.selectText(textObj.id);
      this.isDragging = true;
      this.dragOffset = {
        x: pos.x - textObj.x,
        y: pos.y - textObj.y,
      };
    } else {
      this.selectText(null);
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);
    const selectedText = this.textObjects.find((t) => t.selected);

    if (this.isResizing && selectedText) {
      const newWidth = Math.max(50, pos.x - selectedText.x);
      const newHeight = Math.max(20, pos.y - selectedText.y);
      selectedText.width = newWidth;
      selectedText.height = newHeight;
      this.redraw();
    } else if (this.isDragging && selectedText) {
      selectedText.x = pos.x - this.dragOffset.x;
      selectedText.y = pos.y - this.dragOffset.y;
      this.redraw();
    } else {
      let cursor = "default";
      if (selectedText && this.getResizeHandle(pos.x, pos.y, selectedText)) {
        cursor = "se-resize";
      } else if (this.getTextAt(pos.x, pos.y)) {
        cursor = "move";
      }
      this.canvas.style.cursor = cursor;
    }
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }

  onClick(e) {
    // Handle click events if needed
  }

  downloadMeme() {
    if (!this.backgroundImage) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = this.originalImageWidth;
    tempCanvas.height = this.originalImageHeight;

    const scaleX = this.originalImageWidth / this.canvas.width;
    const scaleY = this.originalImageHeight / this.canvas.height;

    tempCtx.drawImage(
      this.backgroundImage,
      0,
      0,
      this.originalImageWidth,
      this.originalImageHeight
    );

    this.textObjects.forEach((textObj) => {
      tempCtx.save();

      const scaledFontSize = textObj.fontSize * Math.min(scaleX, scaleY);
      tempCtx.font = `bold ${scaledFontSize}px ${textObj.fontFamily}`;
      tempCtx.textAlign = "center";
      tempCtx.textBaseline = "middle";

      const scaledX = (textObj.x + textObj.width / 2) * scaleX;
      const scaledY = (textObj.y + textObj.height / 2) * scaleY;

      if (textObj.strokeWidth > 0) {
        tempCtx.strokeStyle = textObj.stroke;
        tempCtx.lineWidth = textObj.strokeWidth * Math.min(scaleX, scaleY);
        tempCtx.strokeText(textObj.text, scaledX, scaledY);
      }

      tempCtx.fillStyle = textObj.fill;
      tempCtx.fillText(textObj.text, scaledX, scaledY);

      tempCtx.restore();
    });

    const link = document.createElement("a");
    link.download = "quickmeme_" + Date.now() + ".png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  }

  saveState() {
    chrome.storage.local.set({
      quickMemeState: {
        imageUrl: this.backgroundImage?.src || null,
        textObjects: this.textObjects,
        selectedTextId: this.selectedTextId,
      },
    });
  }
}

const quickMeme = new QuickMeme();
