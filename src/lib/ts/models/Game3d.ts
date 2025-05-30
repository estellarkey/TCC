import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { PMREMGenerator } from "three";
import { Chess, Square } from "chess.js";
import gsap from "gsap";
import { ChessBot } from "./../services/bot3d/bot/bot";

export class Chess3DGame {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private chess!: Chess;
  private loader: GLTFLoader = new GLTFLoader();
  private chessBoard: THREE.Group | null = null;
  private pieceObjects: Map<string, THREE.Object3D> = new Map();
  private selectedPiece: { position: string; object: THREE.Object3D } | null = null;
  private squareSize = 1;
  private boardOffset = new THREE.Vector3(-3.5, 0, -3.5);
  private boardCenter = new THREE.Vector3(0, 0, 0);
  private highlightMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xff0000,
    emissiveIntensity: 0.5,
  });
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private frameId: number | null = null;
  private clock!: THREE.Clock;
  private bot!: ChessBot;
  private isPlayerTurn: boolean = true;
  private logObject: THREE.Object3D | null = null;
  private isDragging = false;
  private dragPlane!: THREE.Mesh;
  private dragOffset = new THREE.Vector3();
  private originalPosition = new THREE.Vector3();
  private audioContext!: AudioContext;
  private moveSound!: AudioBuffer;
  private captureSound!: AudioBuffer;
  private checkSound!: AudioBuffer;
  private checkmateSound!: AudioBuffer;
  private audioLoaded = false;

  constructor() {
    this.chess = new Chess();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.initScene();
    this.loadBoardModel();
    this.initInteraction();
    this.animate();
    this.bot = new ChessBot(this.chess);
    this.initDragPlane();
    this.initDragEvents();
    this.loadAudio();
  }

  private initScene(): void {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 18, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    const container = document.getElementById("chess3d-container");
    if (container) container.appendChild(this.renderer.domElement);
    window.addEventListener("resize", () => this.onWindowResize());
    this.loadHDREnvironment();
  }

  private loadHDREnvironment(): void {
    new RGBELoader().setPath("/").load(
      "kloofendal_48d_partly_cloudy_puresky_4k.hdr",
      (texture: THREE.Texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;

        this.scene.environment = texture;
        this.scene.environmentIntensity = 2;
        this.scene.background = new THREE.Color(0x00000);
        this.scene.environmentIntensity = 0.8;

        this.scene.environment = texture;

        this.configureRenderer();
        this.setupLights();
        this.configureMaterials();

        console.log("Ambiente HDR configurado com sucesso!");
      },
      undefined,
      (error: any) => {
        console.error("Erro ao carregar HDR:", error);
        this.setupBasicLights();
      }
    );
  }

  private configureMaterials(): void {
    if (!this.chessBoard) return;

    this.chessBoard.traverse((object: THREE.Object3D) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial
      ) {
        if (object.name.includes("Board")) {
          object.material.envMapIntensity = 0.3;
          object.material.roughness = 0.7;
        } else if (
          object.name.includes("Light_") ||
          object.name.includes("Dark_")
        ) {
          object.material.metalness = 0.9;
          object.material.roughness = 0.2;
          object.material.envMapIntensity = 0.8;
        }
        object.material.needsUpdate = true;
      }
    });
  }

  private configureRenderer(): void {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.6;
  }

  private setupBasicLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private loadBoardModel(): void {

    const modelUrl = "/3d/api/asset?name=Chessboard.glb";

    console.log(`Attempting to load chess board from: ${modelUrl}`);

    this.loader.load(
      modelUrl,
      (gltf: { scene: THREE.Group }) => {
        // Your existing success handler
        this.chessBoard = gltf.scene;
        console.log("Tabuleiro carregado:", this.chessBoard);
        this.chessBoard.traverse((child: THREE.Object3D) => {
          if (
            child instanceof THREE.Mesh &&
            child.material instanceof THREE.MeshStandardMaterial
          ) {
            if (child.name.includes("Chess Board")) {
              child.castShadow = true;
              child.receiveShadow = true;
            } else if (
              child.name.includes("Light_") ||
              child.name.includes("Dark_")
            ) {
              child.castShadow = true;
              child.receiveShadow = true;
            }

            child.matrixAutoUpdate = false;
            child.updateMatrix();
            child.frustumCulled = true;
          }
        });

        this.scene.add(this.chessBoard);

        let boardMesh: THREE.Object3D | null = null;
        this.chessBoard.traverse((child: THREE.Object3D) => {
          if (child.name.includes("Cube") || child.name === "Chess Board") {
            boardMesh = child;
          }
        });

        if (!boardMesh) {
          console.error("Objeto pai não encontrado.");
          return;
        }

        const bbox = new THREE.Box3().setFromObject(boardMesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        this.squareSize = size.x / 8;
        this.boardOffset = new THREE.Vector3(
          bbox.min.x,
          bbox.min.y + 0.7,
          bbox.min.z
        );

        this.organizePieces();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% carregado");
      },
      (error) => {
        console.error("Erro ao carregar o modelo:", error);
      }
    );
  }

  // Add this method to create a procedural chess board
  private createProceduralBoard(): void {
    console.log("Creating procedural chess board as fallback");

    // Create board group
    const boardGroup = new THREE.Group();
    boardGroup.name = "Chess Board";

    // Create board base
    const baseGeometry = new THREE.BoxGeometry(8.2, 0.5, 8.2);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.7,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.3;
    boardGroup.add(base);

    // Create chess squares
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        const isLight = (x + z) % 2 === 0;
        const color = isLight ? 0xeeeed2 : 0x769656;

        const squareGeometry = new THREE.BoxGeometry(1, 0.1, 1);
        const squareMaterial = new THREE.MeshStandardMaterial({
          color: color,
          roughness: isLight ? 0.8 : 0.7,
          metalness: isLight ? 0.1 : 0.2,
        });

        const square = new THREE.Mesh(squareGeometry, squareMaterial);
        square.position.set(x - 3.5 + 0.5, 0, z - 3.5 + 0.5);
        boardGroup.add(square);
      }
    }

    // Add board to scene
    this.scene.add(boardGroup);
    this.chessBoard = boardGroup;

    // Set board parameters
    this.squareSize = 1;
    this.boardOffset = new THREE.Vector3(-3.5, 0, -3.5);

    // Create pieces
    this.createProceduralPieces();
  }

  private createProceduralPieces(): void {
    // Define piece configurations
    const pieceConfig = {
      p: { height: 0.7, baseWidth: 0.3 }, // Pawn
      r: { height: 0.9, baseWidth: 0.4 }, // Rook
      n: { height: 1.0, baseWidth: 0.4 }, // Knight
      b: { height: 1.1, baseWidth: 0.4 }, // Bishop
      q: { height: 1.3, baseWidth: 0.5 }, // Queen
      k: { height: 1.5, baseWidth: 0.5 }, // King
    };

    // Define colors
    const colors = {
      w: 0xf0f0f0, // White
      b: 0x303030, // Black
    };

    // Initial positions
    const initialPositions = {
      b: {
        k: "e8",
        q: "d8",
        b: ["c8", "f8"],
        n: ["b8", "g8"],
        r: ["a8", "h8"],
        p: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"],
      },
      w: {
        k: "e1",
        q: "d1",
        b: ["c1", "f1"],
        n: ["b1", "g1"],
        r: ["a1", "h1"],
        p: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
      },
    };

    // Create pieces for both colors
    for (const [color, pieces] of Object.entries(initialPositions)) {
      for (const [pieceType, positions] of Object.entries(pieces)) {
        if (Array.isArray(positions)) {
          positions.forEach((position, index) => {
            const piece = this.createProcPiece(
              pieceType,
              color,
              pieceConfig[pieceType as keyof typeof pieceConfig],
              colors[color as keyof typeof colors],
              index
            );
            this.pieceObjects.set(position, piece);

            const pos3D = this.get3DPositionFromChessNotation(position);
            piece.position.copy(pos3D);
            this.scene.add(piece);
          });
        } else {
          const piece = this.createProcPiece(
            pieceType,
            color,
            pieceConfig[pieceType as keyof typeof pieceConfig],
            colors[color as keyof typeof colors],
            0
          );
          this.pieceObjects.set(positions, piece);

          const pos3D = this.get3DPositionFromChessNotation(positions);
          piece.position.copy(pos3D);
          this.scene.add(piece);
        }
      }
    }

    console.log("Procedural chess pieces created");
  }

  private createProcPiece(
    type: string,
    color: string,
    config: { height: number; baseWidth: number },
    materialColor: number,
    index: number
  ): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `${color === "w" ? "Light" : "Dark"}_${this.getPieceNameFromType(type, index)}`;

    // Common material
    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.3,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });

    // Base for all pieces
    const baseHeight = config.height * 0.15;
    const baseGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.8,
      config.baseWidth,
      baseHeight,
      16
    );
    const base = new THREE.Mesh(baseGeometry, material);
    base.position.y = baseHeight / 2;
    group.add(base);

    switch (type) {
      case "p": // Pawn
        this.createPawnShape(group, config, material);
        break;
      case "r": // Rook
        this.createRookShape(group, config, material);
        break;
      case "n": // Knight
        this.createKnightShape(group, config, material);
        break;
      case "b": // Bishop
        this.createBishopShape(group, config, material);
        break;
      case "q": // Queen
        this.createQueenShape(group, config, material);
        break;
      case "k": // King
        this.createKingShape(group, config, material);
        break;
    }

    return group;
  }

  // Helper methods to create specific piece shapes
  private createPawnShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyHeight = config.height * 0.5;
    const bodyGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.6,
      config.baseWidth * 0.7,
      bodyHeight,
      16
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.25;

    const headGeometry = new THREE.SphereGeometry(
      config.baseWidth * 0.5,
      16,
      16
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = config.height * 0.6;

    group.add(body);
    group.add(head);
  }

  private createRookShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyHeight = config.height * 0.7;
    const bodyGeometry = new THREE.BoxGeometry(
      config.baseWidth * 0.8,
      bodyHeight,
      config.baseWidth * 0.8
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.4;

    const topGeometry = new THREE.BoxGeometry(
      config.baseWidth * 1.0,
      config.height * 0.2,
      config.baseWidth * 1.0
    );
    const top = new THREE.Mesh(topGeometry, material);
    top.position.y = config.height * 0.85;

    group.add(body);
    group.add(top);
  }

  private createKnightShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.6,
      config.baseWidth * 0.7,
      config.height * 0.5,
      16
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.3;

    const headGeometry = new THREE.SphereGeometry(
      config.baseWidth * 0.5,
      16,
      16
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = config.height * 0.65;
    head.position.x = config.baseWidth * 0.2;
    head.scale.z = 1.5;
    head.rotation.x = -Math.PI / 6;

    const earGeometry = new THREE.ConeGeometry(
      config.baseWidth * 0.3,
      config.height * 0.4,
      8
    );
    const ear = new THREE.Mesh(earGeometry, material);
    ear.position.y = config.height * 0.85;
    ear.position.x = config.baseWidth * 0.1;
    ear.rotation.z = -Math.PI / 6;

    group.add(body);
    group.add(head);
    group.add(ear);
  }

  private createBishopShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.3,
      config.baseWidth * 0.7,
      config.height * 0.6,
      16
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.35;

    const headGeometry = new THREE.SphereGeometry(
      config.baseWidth * 0.4,
      16,
      16
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = config.height * 0.75;

    const topGeometry = new THREE.ConeGeometry(
      config.baseWidth * 0.2,
      config.height * 0.2,
      16
    );
    const top = new THREE.Mesh(topGeometry, material);
    top.position.y = config.height * 0.95;

    group.add(body);
    group.add(head);
    group.add(top);
  }

  private createQueenShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.5,
      config.baseWidth * 0.7,
      config.height * 0.7,
      16
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.4;

    const headGeometry = new THREE.SphereGeometry(
      config.baseWidth * 0.5,
      16,
      16
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = config.height * 0.8;

    // Crown spikes
    for (let i = 0; i < 5; i++) {
      const spikeGeometry = new THREE.ConeGeometry(
        config.baseWidth * 0.15,
        config.height * 0.2,
        8
      );
      const spike = new THREE.Mesh(spikeGeometry, material);
      spike.position.y = config.height * 1.0;

      // Position in a circle
      const angle = (i / 5) * Math.PI * 2;
      spike.position.x = Math.sin(angle) * config.baseWidth * 0.3;
      spike.position.z = Math.cos(angle) * config.baseWidth * 0.3;

      group.add(spike);
    }

    group.add(body);
    group.add(head);
  }

  private createKingShape(
    group: THREE.Group,
    config: { height: number; baseWidth: number },
    material: THREE.Material
  ): void {
    const bodyGeometry = new THREE.CylinderGeometry(
      config.baseWidth * 0.5,
      config.baseWidth * 0.7,
      config.height * 0.7,
      16
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = config.height * 0.4;

    const headGeometry = new THREE.SphereGeometry(
      config.baseWidth * 0.5,
      16,
      16
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = config.height * 0.8;

    // Cross
    const vertCrossGeometry = new THREE.BoxGeometry(
      config.baseWidth * 0.15,
      config.height * 0.3,
      config.baseWidth * 0.15
    );
    const vertCross = new THREE.Mesh(vertCrossGeometry, material);
    vertCross.position.y = config.height * 1.1;

    const horizCrossGeometry = new THREE.BoxGeometry(
      config.baseWidth * 0.4,
      config.height * 0.15,
      config.baseWidth * 0.15
    );
    const horizCross = new THREE.Mesh(horizCrossGeometry, material);
    horizCross.position.y = config.height * 1.05;

    group.add(body);
    group.add(head);
    group.add(vertCross);
    group.add(horizCross);
  }

  private getPieceNameFromType(type: string, index: number): string {
    switch (type) {
      case "k":
        return "King";
      case "q":
        return "Queen";
      case "b":
        return `Bishop_${index + 1}`;
      case "n":
        return `Knight_${index + 1}`;
      case "r":
        return `Rock_${index + 1}`; // Match your original naming
      case "p":
        return `Pawn_${index + 1}`;
      default:
        return type;
    }
  }

  private findObjectByName(
    object: THREE.Object3D,
    name: string
  ): THREE.Object3D | null {
    if (object.name === name) return object;

    for (const child of object.children) {
      const found = this.findObjectByName(child, name);
      if (found) return found;
    }

    return null;
  }

  private printAllObjectNames(object: THREE.Object3D, indent = ""): void {
    console.log(indent + object.name);
    object.children.forEach((child: any) =>
      this.printAllObjectNames(child, indent + "  ")
    );
  }

  private organizePieces(): void {
    if (!this.chessBoard) return;

    const pieceNamePatterns = {
      k: ["King"],
      q: ["Queen"],
      b: ["Bishop_1", "Bishop_2"],
      n: ["Knight_1", "Knight_2"],
      r: ["Rock_1", "Rock_2"],
      p: Array.from({ length: 8 }, (_, i) => `Pawn_${i + 1}`),
    };

    const initialPositions = {
      b: {
        k: "e8",
        q: "d8",
        b: ["c8", "f8"],
        n: ["b8", "g8"],
        r: ["a8", "h8"],
        p: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"],
      },
      w: {
        k: "e1",
        q: "d1",
        b: ["c1", "f1"],
        n: ["b1", "g1"],
        r: ["a1", "h1"],
        p: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
      },
    };

    for (const [color, colorPrefix] of [
      ["w", "Light"],
      ["b", "Dark"],
    ] as const) {
      for (const [pieceType, patterns] of Object.entries(pieceNamePatterns)) {
        const positions =
          initialPositions[color][
          pieceType as "k" | "q" | "b" | "n" | "r" | "p"
          ];

        patterns.forEach((pattern, index) => {
          const pieceName = `${colorPrefix}_${pattern}`;
          const piece = this.chessBoard!.getObjectByName(pieceName);

          if (piece) {
            // Otimização: Configurar peças para renderização estática
            piece.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                child.matrixAutoUpdate = false;
                child.frustumCulled = true;
              }
            });

            const pos = Array.isArray(positions) ? positions[index] : positions;
            this.pieceObjects.set(pos, piece);
            this.movePieceToPosition(piece, pos);
          }
        });
      }
    }
  }

  public updateBoardFromFEN(fen: string): void {
    this.chess.load(fen);

    // Esconde todas as peças
    this.pieceObjects.forEach((piece) => (piece.visible = false));

    // Atualiza as peças visíveis de acordo com o FEN
    const board = this.chess.board();
    board.forEach((row: any[], rankIndex: number) => {
      row.forEach(
        (piece: { type: string; color: string }, fileIndex: number) => {
          if (piece) {
            const position =
              String.fromCharCode(97 + fileIndex) + (8 - rankIndex);
            const pieceObj = this.pieceObjects.get(position);
            if (pieceObj) {
              pieceObj.visible = true;
              this.movePieceToPosition(pieceObj, position);
            } else {
  
              this.handlePromotedPiece(piece, position);
            }
          }
        }
      );
    });
  }
  private handlePromotedPiece(
    piece: { type: string; color: string },
    position: string
  ): void {
    // Encontra uma peça do tipo correto que não está em uso
    for (const [pos, pieceObj] of this.pieceObjects.entries()) {
      if (!pieceObj.visible) {
        const pieceName = pieceObj.name.toLowerCase();
        if (
          (piece.color === "w" && pieceName.includes("light")) ||
          (piece.color === "b" && pieceName.includes("dark"))
        ) {
          const typeMatch = pieceName.includes(piece.type.toLowerCase());
          if (typeMatch) {
            pieceObj.visible = true;
            this.movePieceToPosition(pieceObj, position);
            this.pieceObjects.delete(pos);
            this.pieceObjects.set(position, pieceObj);
            break;
          }
        }
      }
    }
  }

  public resetBoard(): void {
    this.chess.reset();
    this.organizePieces();
    this.isPlayerTurn = true;
    this.renderer.domElement.style.pointerEvents = "auto";
  }

  private movePieceToPosition(piece: THREE.Object3D, position: string): void {
    const targetPos = this.get3DPositionFromChessNotation(position);
    piece.position.copy(targetPos);
    piece.updateMatrix();
  }

  private initInteraction(): void {
    // Otimização: Usar eventos passive quando possível
    this.renderer.domElement.addEventListener(
      "click",
      this.handleClick.bind(this),
      { passive: false }
    );
  }

  private handleClick(event: MouseEvent): void {
    event.preventDefault();

    // Atualizar posição do mouse
    this.mouse.x =
      (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y =
      -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Verifica se clicou em uma peça
    const pieces = Array.from(this.pieceObjects.values()).filter(
      (p) => p.visible
    );
    const intersects = this.raycaster.intersectObjects(pieces, true);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      for (const [position, piece] of this.pieceObjects.entries()) {
        if (piece === clickedObject || piece.children.includes(clickedObject)) {
          // Se clicou na mesma peça já selecionada, desseleciona
          if (this.selectedPiece?.position === position) {
            this.removeHighlight();
            this.selectedPiece = null;
            return;
          }

          this.highlightPiece(position);
          this.selectedPiece = { position, object: piece };
          return;
        }
      }
    }

    // Tenta mover a peça selecionada
    if (this.selectedPiece && this.chessBoard) {
      const intersects = this.raycaster.intersectObject(this.chessBoard, true);
      if (intersects.length > 0) {
        const targetPosition = this.getPositionFromIntersect(intersects[0]);
        if (targetPosition) {
          this.tryMove(this.selectedPiece.position, targetPosition);
        }
      }
      this.removeHighlight();
      this.selectedPiece = null;
    }
  }

  private getPositionFromIntersect(
    intersect: THREE.Intersection
  ): string | null {
    const worldPoint = intersect.point.clone();
    const relativeX = worldPoint.x - this.boardOffset.x;
    const relativeZ = worldPoint.z - this.boardOffset.z;

    const fileIndex = Math.floor(relativeX / this.squareSize);
    const rankIndex = 7 - Math.floor(relativeZ / this.squareSize);

    if (fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8) {
      const file = String.fromCharCode(97 + fileIndex);
      const rank = rankIndex + 1;
      return file + rank;
    }

    return null;
  }

  private checkForWin(): void {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === "w" ? "Black" : "White";
      console.log(`Xeque-mate! ${winner} venceu!`);
      this.playSound(this.checkmateSound, 1.0);
      alert(`Xeque-mate! ${winner} venceu!`);

      // Opcional: Desativar interações após o fim do jogo
      this.renderer.domElement.style.pointerEvents = "none";
    } else if (this.chess.isDraw()) {
      console.log("Empate!");
      alert("Empate!");
    } else if (this.chess.isCheck()) {
      console.log("Xeque!");
      this.playSound(this.checkSound, 0.8);
    }
  }


  private playSound(buffer: AudioBuffer, volume = 1.0, rate = 1.0): void {
    if (!this.audioLoaded) return;

    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      source.playbackRate.value = rate;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
    }
  }

  private async loadAudio(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();


      const sounds = {
        move: '/sounds/move.mp3',
        capture: '/sounds/capture.mp3',
        check: '/sounds/check.mp3',
        checkmate: '/sounds/checkmate.mp3'
      };

      const loadSound = async (url: string): Promise<AudioBuffer> => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
      };

      this.moveSound = await loadSound(sounds.move);
      this.captureSound = await loadSound(sounds.capture);
      this.checkSound = await loadSound(sounds.check);
      this.checkmateSound = await loadSound(sounds.checkmate);

      this.audioLoaded = true;
      console.log('Todos os sons foram carregados com sucesso!');
    } catch (error) {
      console.error('Erro ao carregar sons:', error);

    }
  }


  private createBeepSound(frequency: number, duration: number): AudioBuffer {
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / this.audioContext.sampleRate);
    }

    return buffer;
  }


  private makeMove(from: string, to: string, isBotMove = false): void {
    try {
      const fromSquare = from as Square;
      const toSquare = to as Square;

      const capturedPiece = this.chess.get(toSquare);
      const move = this.chess.move({
        from: fromSquare,
        to: toSquare,
        promotion: "q",
      });

      if (move) {
        // Tocar som de movimento ou captura
        if (move.captured) {
          this.playSound(this.captureSound, 0.7);
        } else {
          this.playSound(this.moveSound, 0.5);
        }

        const pieceObj = this.pieceObjects.get(from);
        if (!pieceObj) return;

        // Remove a peça capturada se existir
        if (capturedPiece) {
          const capturedPieceObj = this.pieceObjects.get(to);
          if (capturedPieceObj) {
            capturedPieceObj.visible = false;
            this.pieceObjects.delete(to);
          }
        }

        // Atualiza a posição da peça
        this.pieceObjects.delete(from);
        this.pieceObjects.set(to, pieceObj);

        // Animação
        const targetPos = this.get3DPositionFromChessNotation(to);
        gsap.to(pieceObj.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 0.3,
          ease: "power2.out",
          onComplete: () => {
            pieceObj.updateMatrix();
            this.checkForWin();

            if (
              !isBotMove &&
              !this.chess.isGameOver() &&
              this.chess.turn() !== (this.isPlayerTurn ? "w" : "b")
            ) {
              this.makeBotMove();
            }
          },
        });
      }
    } catch (e) {
      console.error("Movimento inválido:", e);
    }
  }

  private initDragPlane(): void {
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide
    });
    this.dragPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.dragPlane.rotation.x = -Math.PI / 2;
    this.dragPlane.position.y = 0;
    this.scene.add(this.dragPlane);
  }

  private initDragEvents(): void {
    const domElement = this.renderer.domElement;

    // Evento de início do arrasto
    domElement.addEventListener('mousedown', (event) => {
      if (this.isPlayerTurn) {
        this.handleMouseDown(event);
      }
    }, { passive: false });

    // Evento durante o arrasto
    domElement.addEventListener('mousemove', (event) => {
      if (this.isDragging && this.isPlayerTurn) {
        this.handleMouseMove(event);
      }
    }, { passive: false });

    // Evento de término do arrasto
    domElement.addEventListener('mouseup', (event) => {
      if (this.isDragging && this.isPlayerTurn) {
        this.handleMouseUp(event);
      }
    }, { passive: false });

    // Para touch devices
    domElement.addEventListener('touchstart', (event) => {
      if (this.isPlayerTurn) {
        event.preventDefault();
        this.handleTouchStart(event);
      }
    }, { passive: false });

    domElement.addEventListener('touchmove', (event) => {
      if (this.isDragging && this.isPlayerTurn) {
        event.preventDefault();
        this.handleTouchMove(event);
      }
    }, { passive: false });

    domElement.addEventListener('touchend', (event) => {
      if (this.isDragging && this.isPlayerTurn) {
        event.preventDefault();
        this.handleTouchEnd(event);
      }
    }, { passive: false });
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();

    this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const pieces = Array.from(this.pieceObjects.values()).filter(p => p.visible);
    const intersects = this.raycaster.intersectObjects(pieces, true);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      for (const [position, piece] of this.pieceObjects.entries()) {
        if (piece === clickedObject || piece.children.includes(clickedObject)) {
          const pieceColor = piece.name.toLowerCase().includes('light') ? 'w' : 'b';
          if ((pieceColor === 'w' && this.isPlayerTurn) || (pieceColor === 'b' && !this.isPlayerTurn)) {
            this.startDragging(piece, position);
            return;
          }
        }
      }
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.handleMouseDown(mouseEvent);
  }

  private startDragging(piece: THREE.Object3D, position: string): void {
    this.isDragging = true;
    this.selectedPiece = { position, object: piece };
    this.originalPosition.copy(piece.position);

    // Calcular offset entre o clique e a posição da peça
    const intersects = this.raycaster.intersectObject(this.dragPlane);
    if (intersects.length > 0) {
      this.dragOffset.copy(intersects[0].point).sub(piece.position);
    }

    // Elevar a peça ligeiramente durante o arrasto
    gsap.to(piece.position, {
      y: this.originalPosition.y + 0.5,
      duration: 0.2
    });

    this.highlightPiece(position);
  }

  private handleMouseMove(event: MouseEvent): void {
    event.preventDefault();

    this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    this.updateDraggedPiece();
  }

  private handleTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.handleMouseMove(mouseEvent);
  }

  private updateDraggedPiece(): void {
    if (!this.selectedPiece) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.dragPlane);

    if (intersects.length > 0) {
      const newPosition = intersects[0].point.clone().sub(this.dragOffset);
      this.selectedPiece.object.position.set(newPosition.x, this.selectedPiece.object.position.y, newPosition.z);
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    event.preventDefault();
    this.finishDragging();
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.finishDragging();
  }

  private finishDragging(): void {
    if (!this.isDragging || !this.selectedPiece) return;

    this.isDragging = false;

    // Verificar se soltou em uma posição válida
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.chessBoard || this.dragPlane, true);

    if (intersects.length > 0) {
      const targetPosition = this.getPositionFromIntersect(intersects[0]);
      if (targetPosition) {
        this.tryMove(this.selectedPiece.position, targetPosition);
      } else {
        // Retornar à posição original se não for um movimento válido
        this.returnPieceToOriginalPosition();
      }
    } else {
      this.returnPieceToOriginalPosition();
    }

    this.removeHighlight();
    this.selectedPiece = null;
  }

  private returnPieceToOriginalPosition(): void {
    if (!this.selectedPiece) return;

    gsap.to(this.selectedPiece.object.position, {
      x: this.originalPosition.x,
      y: this.originalPosition.y,
      z: this.originalPosition.z,
      duration: 0.3,
      ease: "power2.out"
    });
  }

  private tryMove(from: string, to: string): void {
    const piece = this.chess.get(from as Square);
    if (
      !piece ||
      (piece.color === "w" && !this.isPlayerTurn) ||
      (piece.color === "b" && this.isPlayerTurn)
    ) {
      this.removeHighlight();
      this.selectedPiece = null;
      return;
    }

    try {
      const fromSquare = from as Square;
      const toSquare = to as Square;
      const piece = this.chess.get(fromSquare);

      if (!piece) return;

      // Verifica se há uma peça no quadrado de destino ANTES do movimento
      const potentialCapture = this.chess.get(toSquare);

      if (
        piece.type === "k" &&
        Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2
      ) {
        this.handleCastle(fromSquare, toSquare);
        return;
      }

      const moveOptions = this.chess.moves({ verbose: true });
      const enPassantMove = moveOptions.find(
        (m: { from: any; to: any; flags: string | string[] }) =>
          m.from === fromSquare && m.to === toSquare && m.flags.includes("e")
      );

      if (piece.type === "p" && enPassantMove) {
        this.handleEnPassant(fromSquare, toSquare);
        return;
      }

      const move = this.chess.move({
        from: fromSquare,
        to: toSquare,
        promotion: "q",
      });

      if (move) {
        // Tocar sons APÓS confirmar o movimento válido
        if (move.captured) {
          this.playSound(this.captureSound, 0.7);
        } else {
          this.playSound(this.moveSound, 0.5);
        }

        if (this.chess.isCheckmate()) {
          this.playSound(this.checkmateSound, 1.0);
        } else if (this.chess.isCheck()) {
          this.playSound(this.checkSound, 0.8);
        }

        this.handleRegularMove(from, to, move.captured);
      }
    } catch (e) {
      console.error("Movimento inválido:", e);
    }
  }

  private handleRegularMove(
    from: string,
    to: string,
    captured: string | undefined
  ): void {
    const pieceObj = this.pieceObjects.get(from);
    if (!pieceObj) return;

    // Remove peça capturada
    if (captured) {
      const capturedPieceObj = this.pieceObjects.get(to);
      if (capturedPieceObj) {
        capturedPieceObj.visible = false;
        this.pieceObjects.delete(to);
      }
    }

    // Atualiza posições
    this.pieceObjects.delete(from);
    this.pieceObjects.set(to, pieceObj);

    // Animação
    this.animatePieceMove(pieceObj, to, () => {
      this.checkForWin();
      if (
        !this.chess.isGameOver() &&
        this.chess.turn() !== (this.isPlayerTurn ? "w" : "b")
      ) {
        this.makeBotMove();
      }
    });
  }

  private handleCastle(from: Square, to: Square): void {
    const isKingside = to.charCodeAt(0) > from.charCodeAt(0);
    const rookFrom = isKingside
      ? String.fromCharCode("h".charCodeAt(0)) + from[1]
      : String.fromCharCode("a".charCodeAt(0)) + from[1];
    const rookTo = isKingside
      ? String.fromCharCode("f".charCodeAt(0)) + from[1]
      : String.fromCharCode("d".charCodeAt(0)) + from[1];

    // Move o rei (isso automaticamente move a torre no chess.js)
    const move = this.chess.move({ from, to, promotion: "q" });
    if (!move) return;

    // Encontra os objetos 3D das peças
    const kingObj = this.pieceObjects.get(from);
    const rookObj = this.pieceObjects.get(rookFrom);

    if (kingObj && rookObj) {
      // Remove as peças das posições antigas
      this.pieceObjects.delete(from);
      this.pieceObjects.delete(rookFrom);

      // Adiciona nas novas posições
      this.pieceObjects.set(to, kingObj);
      this.pieceObjects.set(rookTo, rookObj);

      // Anima ambas as peças
      let movesCompleted = 0;
      const onComplete = () => {
        movesCompleted++;
        if (movesCompleted === 2) {
          this.checkForWin();
          if (
            !this.chess.isGameOver() &&
            this.chess.turn() !== (this.isPlayerTurn ? "w" : "b")
          ) {
            this.makeBotMove();
          }
        }
      };

      this.animatePieceMove(kingObj, to, onComplete);
      this.animatePieceMove(rookObj, rookTo, onComplete);
    }
  }

  private handleEnPassant(from: Square, to: Square): void {
    const move = this.chess.move({ from, to, promotion: "q" });
    if (!move) return;

  
    const capturedPawnPos = (to[0] + from[1]) as Square;

    const pieceObj = this.pieceObjects.get(from);
    const capturedPieceObj = this.pieceObjects.get(capturedPawnPos);

    if (pieceObj && capturedPieceObj) {
      capturedPieceObj.visible = false;
      this.pieceObjects.delete(capturedPawnPos);

      this.animatePieceMove(pieceObj, to, () => {
        this.checkForWin();
        if (
          !this.chess.isGameOver() &&
          this.chess.turn() !== (this.isPlayerTurn ? "w" : "b")
        ) {
          this.makeBotMove();
        }
      });

      this.pieceObjects.delete(from);
      this.pieceObjects.set(to, pieceObj);
    }
  }

  private animatePieceMove(
    piece: THREE.Object3D,
    to: string,
    onComplete: () => void
  ): void {
    const targetPos = this.get3DPositionFromChessNotation(to);


    gsap.to(piece.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
        piece.updateMatrix();
        onComplete();
      }
    });
  }

  private makeBotMove(): void {
    this.renderer.domElement.style.pointerEvents = "none";

    const botMove = this.bot.makeSimpleEvaluatedMove();

    if (botMove) {
      // Pequeno atraso para melhor experiência visual
      gsap.delayedCall(0.5, () => {
        this.executeBotMove(botMove.from, botMove.to);
      });
    }
  }

  private executeBotMove(from: Square, to: Square): void {
    const fromStr = from.toString();
    const toStr = to.toString();

    const pieceObj = this.pieceObjects.get(fromStr);
    if (!pieceObj) return;

    const capturedPiece = this.chess.get(to);
    const move = this.chess.move({ from, to, promotion: "q" });

    if (move) {
      // Tocar som de movimento ou captura
      if (move.captured) {
        this.playSound(this.captureSound, 0.7);
      } else {
        this.playSound(this.moveSound, 0.5);
      }

      // Remove a peça capturada se existir
      if (capturedPiece) {
        const capturedPieceObj = this.pieceObjects.get(toStr);
        if (capturedPieceObj) {
          capturedPieceObj.visible = false;
          this.pieceObjects.delete(toStr);
        }
      }

      // Atualiza posição da peça
      this.pieceObjects.delete(fromStr);
      this.pieceObjects.set(toStr, pieceObj);

      // Animação do movimento do bot
      const targetPos = this.get3DPositionFromChessNotation(toStr);
      gsap.to(pieceObj.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
          pieceObj.updateMatrix();
          this.checkForWin();

          // Reativa a interação para o jogador
          this.renderer.domElement.style.pointerEvents = "auto";
        },
      });
    }
  }

  private highlightPiece(position: string): void {
    this.removeHighlight();

    const selectedPiece = this.pieceObjects.get(position);
    if (!selectedPiece) return;

    const mesh = this.getMainMesh(selectedPiece);
    if (mesh?.material) {
      // Usar material compartilhado para highlight
      mesh.userData.originalMaterial = mesh.material;
      mesh.material = this.highlightMaterial;
    }
  }

  private removeHighlight(): void {
    this.pieceObjects.forEach((piece) => {
      const mesh = this.getMainMesh(piece);
      if (mesh?.userData?.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
        delete mesh.userData.originalMaterial;
      }
    });
  }

  private getMainMesh(object: THREE.Object3D | undefined): THREE.Mesh | null {
    if (!object) return null;
    if (object instanceof THREE.Mesh) return object;

    // Otimização: Usar busca simples para peças
    for (let i = 0; i < object.children.length; i++) {
      const child = object.children[i];
      if (child instanceof THREE.Mesh) {
        return child;
      }
    }
    return null;
  }
  private get3DPositionFromChessNotation(position: string): THREE.Vector3 {
    const file = position.charCodeAt(0) - "a".charCodeAt(0);
    const rank = 8 - parseInt(position[1]);

    return new THREE.Vector3(
      this.boardOffset.x + file * this.squareSize + this.squareSize / 2,
      this.boardOffset.y,
      this.boardOffset.z + rank * this.squareSize + this.squareSize / 2
    );
  }

  private animate(): void {
    this.frameId = requestAnimationFrame(() => this.animate());

    // Otimização: Renderização condicional baseada em necessidade
    const delta = this.clock.getDelta();
    if (delta > 0) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private addReflectiveFloor(): void {
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 0.8,
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }
  public dispose(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.renderer.domElement.removeEventListener("click", this.handleClick);
    window.removeEventListener("resize", this.onWindowResize);

    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    if (
      this.scene.background &&
      this.scene.background instanceof THREE.Texture
    ) {
      this.scene.background.dispose();
    }

    this.renderer.dispose();

    this.scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m: THREE.Material) => m.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    });
  }
}
