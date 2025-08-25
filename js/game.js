(function () {
  // create gameDiv if missing
  if (!document.getElementById("gameDiv")) {
    const gd = document.createElement("div");
    gd.id = "gameDiv";
    gd.style.width = "100%";
    gd.style.height = "100%";
    gd.style.display = "flex";
    gd.style.justifyContent = "center";
    gd.style.alignItems = "center";
    document.body.prepend(gd);
  }

  // LocalStorage keys
  const LS = {
    difficulty: "mfd_difficulty", // 'easy'|'medium'|'hard'
    music: "mfd_music", // 'true'|'false'
    sfx: "mfd_sfx", // 'true'|'false'
    high: "mfd_high",
  };

  // default settings
  const SETTINGS = {
    difficulty: localStorage.getItem(LS.difficulty) || "easy",
    music: (localStorage.getItem(LS.music) || "true") === "true",
    sfx: (localStorage.getItem(LS.sfx) || "true") === "true",
  };

  // Utility - clamp
  // const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Game config (fixed canvas)
  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 600;

  // Game timing config
  const BASE_TIME = 2000; // 2 seconds base
  const MIN_TIME = 700; // optional, ensures it never gets too fast
  const DECREASE_PER_5 = 100; // educe 100 ms every 5 points

  // Alert Modal Scene
  class BaseScene extends Phaser.Scene {
    constructor(config) {
      super(config);
    }

    showAlertModal(message = "Alert", options = {}) {
      const { buttonText = "OK", onClose = null } = options;

      const W = this.scale.width;
      const H = this.scale.height;

      const boxW = Math.min(W * 0.8, 460);
      const boxH = 160;
      const centerX = W / 2;
      const centerY = H / 2;

      // Dark background to block input
      const blocker = this.add
        .rectangle(centerX, centerY, W, H, 0x000000, 0.5)
        .setInteractive()
        .setDepth(500);

      const panel = this.add.graphics().setDepth(501);
      panel.fillStyle(0x0f0f0f, 0.95);
      panel.lineStyle(2, 0x00ffc3, 1);
      panel.fillRoundedRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 18);
      panel.strokeRoundedRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 18);

      const msgText = this.add
        .text(centerX, centerY - 30, message, {
          fontFamily: '"Luckiest Guy", cursive',
          fontSize: "18px",
          color: "#ffffff",
          wordWrap: { width: boxW - 40 },
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(502);

      const btnW = 120;
      const btnH = 40;
      const btnY = centerY + 30;

      const btnBg = this.add.graphics().setDepth(502);
      btnBg.fillStyle(0x222222, 1);
      btnBg.fillRoundedRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
      btnBg.setInteractive(
        new Phaser.Geom.Rectangle(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH),
        Phaser.Geom.Rectangle.Contains
      );
      btnBg.input.cursor = "pointer";

      const btnText = this.add
        .text(centerX, btnY, buttonText, {
          fontFamily: '"Luckiest Guy", cursive',
          fontSize: "16px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(503);

      btnBg.on("pointerover", () => {
        btnBg.clear();
        btnBg.fillStyle(0x00ffc3, 1);
        btnBg.fillRoundedRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
        btnText.setColor("#000000");
      });

      btnBg.on("pointerout", () => {
        btnBg.clear();
        btnBg.fillStyle(0x222222, 1);
        btnBg.fillRoundedRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
        btnText.setColor("#ffffff");
      });

      btnBg.on("pointerdown", () => {
        blocker.destroy();
        panel.destroy();
        msgText.destroy();
        btnBg.destroy();
        btnText.destroy();
        if (onClose) onClose();
      });
    }

    showPromptModal(message = "Enter text:", defaultValue = "", maxLength = 100, callback = () => { }) {
      const W = this.scale.width;
      const H = this.scale.height;
      const centerX = W / 2;
      const centerY = H / 2;
      const boxW = Math.min(W * 0.86, 480);
      const boxH = 260;

      // Block UI interaction underneath
      const blocker = this.add.rectangle(centerX, centerY, W, H, 0x000000, 0.6)
        .setInteractive()
        .setDepth(900);

      // Modal panel
      const panel = this.add.graphics().setDepth(901);
      panel.fillStyle(0x121212, 0.95);
      panel.lineStyle(2, 0x00ffc3, 1);
      panel.fillRoundedRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 20);
      panel.strokeRoundedRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 20);

      // Prompt message
      const msgText = this.add.text(centerX, centerY - 80, message, {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: boxW - 40 }
      }).setOrigin(0.5).setDepth(902);

      // DOM Input
      const domInput = this.add.dom(centerX, centerY - 20).createFromHTML(`
        <input type="text"
          maxlength="${maxLength}"
          placeholder="${defaultValue}"
          value="${defaultValue}"
          style="
            width: ${boxW * 0.75}px;
            padding: 10px;
            font-size: 16px;
            font-family: 'Luckiest Guy', cursive;
            border-radius: 8px;
            border: 2px solid #00ffc3;
            background: #111;
            color: #fff;
            text-align: center;
            outline: none;
          ">
        `).setDepth(902);

      // Force focus after a frame delay (workaround for known Phaser bug) :contentReference[oaicite:1]{index=1}
      this.time.delayedCall(100, () => domInput.node.querySelector('input').focus());

      // Button creation helper
      const makeBtn = (label, x, callbackFn) => {
        const btnY = centerY + 60;

        // Create text object
        const text = this.add.text(0, 0, label, {
          fontFamily: '"Luckiest Guy", cursive',
          fontSize: "18px",
          color: "#ffffff",
          align: "center",
        }).setOrigin(0.5).setDepth(904);

        // Padding for background
        const paddingX = 20;
        const paddingY = 12;
        const rectWidth = text.width + paddingX * 2;
        const rectHeight = text.height + paddingY * 2;
        const radius = 14;

        // Create rounded rectangle background
        const bg = this.add.graphics().setDepth(903);
        bg.fillStyle(0x222222, 1);
        bg.fillRoundedRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight, radius);

        // Group both into container and center them together
        const container = this.add.container(x, btnY, [bg, text])
          .setSize(rectWidth, rectHeight)
          .setDepth(903)
          .setInteractive({ useHandCursor: true });

        // Hover effects
        container.on("pointerover", () => {
          bg.clear();
          bg.fillStyle(0x00ffc3, 1);
          bg.fillRoundedRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight, radius);
          text.setColor("#000000");
        });

        container.on("pointerout", () => {
          bg.clear();
          bg.fillStyle(0x222222, 1);
          bg.fillRoundedRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight, radius);
          text.setColor("#ffffff");
        });

        // Click event
        container.on("pointerdown", () => {
          const val = domInput.node.querySelector("input").value.trim();
          cleanup();
          callbackFn(val);
        });

        return container;
      };


      const okBtn = makeBtn("Submit", centerX - 80, callback);
      const cancelBtn = makeBtn("Cancel", centerX + 80, () => callback(null));

      const cleanup = () => {
        blocker.destroy();
        panel.destroy();
        msgText.destroy();
        domInput.destroy();
        okBtn.destroy();
        cancelBtn.destroy();
      };
    }

  }

  // Scenes
  class BootScene extends BaseScene {
    constructor() {
      super("BootScene");
    }

    preload() {
      // load logo
      this.load.image("logo", "assets/logo/mind_flip_dash_logo.png");

      // arrows for touch buttons (PNGs)
      this.load.image("arrow_up", "assets/arrows/up.svg");
      this.load.image("arrow_down", "assets/arrows/down.svg");
      this.load.image("arrow_left", "assets/arrows/left.svg");
      this.load.image("arrow_right", "assets/arrows/right.svg");
      this.load.image("arrow_ne", "assets/arrows/ne.svg");
      this.load.image("arrow_nw", "assets/arrows/nw.svg");
      this.load.image("arrow_se", "assets/arrows/se.svg");
      this.load.image("arrow_sw", "assets/arrows/sw.svg");

      // sounds
      this.load.audio("bgMusic", "assets/sounds/background.mp3");
      this.load.audio("successSfx", "assets/sounds/success.mp3");
      this.load.audio("failSfx", "assets/sounds/fail.mp3");
      this.load.audio("doorSfx", "assets/sounds/opening_door.mp3");

      // load google fonts
      this.fontsReady = false;
      WebFont.load({
        google: {
          families: ["Luckiest Guy"]
        },
        active: () => {
          this.fontsReady = true;
        },
      });

    }

    update() {
      if (this.fontsReady) {
        this.scene.start("MenuScene");
      }
    }

    create() {
      this.scene.start("MenuScene");
    }
  }

  class MenuScene extends BaseScene {
    constructor() {
      super("MenuScene");
    }

    create() {
      const W = this.scale.width;
      const H = this.scale.height;

      // background simulation: faint logos to look blurred
      if (this.textures.exists("logo")) {
        const s = 1; // Slightly larger for a "blurry" feel
        const a = 0.1; // Low alpha for subtle blur-like appearance

        this.add
          .image(W / 2, H / 2, "logo")
          .setScale((Math.min(W, H) / 600) * s)
          .setAlpha(a);
      } else {
        this.cameras.main.setBackgroundColor(0x0b0b0b);
      }

      // title
      const titleSize = Math.floor(Math.min(W, H) / 14);
      this.add
        .text(W / 2, H * 0.18, "🚀 Mind Flip Dash", {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: `${titleSize}px`,
          color: "#00ffc3",
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio);

      // subtitle
      const subSize = Math.floor(Math.min(W, H) / 36);
      this.add
        .text(
          W / 2,
          H * 0.28,
          "Test your reflexes by quickly matching opposite arrow directions.\n Stay sharp and aim for the high score!",
          {
            fontFamily: '"Luckiest Guy", "cursive"',
            fontSize: `${subSize}px`,
            color: "#ddd",
            align: "center",
            wordWrap: { width: Math.min(W * 0.8, 1000) },
          }
        )
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio);

      // Buttons (center)
      const yBase = H * 0.42;
      const gap = Math.min(80, Math.max(48, H * 0.1));
      this._makeRoundedButton(W / 2, yBase, "🎮 Start", () => {
        // ensure music is allowed (user gesture)
        if (SETTINGS.music) {
          const menuBg = this.sound.get("bgMusic");
          if (menuBg && !menuBg.isPlaying) {
            const result = menuBg.play();
            if (result && typeof result.catch === "function") {
              result.catch(() => { });
            }
          }
        }
        // launch door animation scene; it will start GameScene on complete
        this.scene.run("DoorScene", { from: "MenuScene" });
        this.scene.sleep("MenuScene");
      });

      this._makeRoundedButton(W / 2, yBase + gap, "🏆 Leaderboard", () =>
        this.scene.start("LeaderboardScene")
      );
      this._makeRoundedButton(W / 2, yBase + gap * 2, "⚙️ Settings", () =>
        this.scene.start("SettingsScene")
      );
      this._makeRoundedButton(W / 2, yBase + gap * 3, "🕹 How to Play", () =>
        this._openHowTo()
      );

      // bottom-right stats: visitors, likes, dislikes and feedback
      this._setupStatsUI(W, H);

      // bottom-left footer links: privacy-policy, tersm-of-service and blog
      const linkStyle = {
        fontFamily: '"Luckiest Guy", "cursive"',
        fontSize: Math.max(12, Math.floor(Math.min(W, H) / 52)),
        color: "#ffffff",
      };

      const footerY = H - 22;
      const leftMargin = 18;
      const footerGap = 10;

      // Create links as individual text objects
      const links = [
        { label: "Privacy Policy", url: "assets/html/privacy_policy.html" },
        { label: "Terms of Service", url: "assets/html/terms_of_service.html" },
        { label: "Blog", url: "assets/html/blog.html" },
      ];

      let currentX = leftMargin;

      links.forEach((link, i) => {
        const linkText = this.add
          .text(currentX, footerY, link.label, linkStyle)
          .setOrigin(0, 1)
          .setDepth(2)
          .setInteractive({ useHandCursor: true });

        linkText.on("pointerover", () =>
          linkText.setStyle({ color: "#00ffc3" })
        );
        linkText.on("pointerout", () =>
          linkText.setStyle({ color: "#ffffff" })
        );
        linkText.on("pointerdown", () => window.open(link.url, "_blank"));

        currentX += linkText.width + footerGap;
      });

      // background music
      if (!this.sound.get("bgMusic")) {
        this.bg = this.sound.add("bgMusic", { loop: true, volume: 0.35 });
      } else {
        this.bg = this.sound.get("bgMusic");
      }

      if (SETTINGS.music && !this.bg.isPlaying) {
        const result = this.bg.play();
        if (result && typeof result.catch === "function") {
          result.catch(() => { });
        }
      }

      // update stats occasionally
      this._refreshStats();
      // this.time.addEvent({ delay: 12000, callback: this._refreshStats, callbackScope: this, loop: true });
    }

    _makeRoundedButton(x, y, label, callback) {
      const W = this.scale.width;
      const H = this.scale.height;

      const fontSize = Math.max(16, Math.floor(Math.min(W, H) / 28));
      const paddingX = 28;
      const paddingY = 12;
      const radius = 12;

      // Create text first to get size
      const text = this.add.text(0, 0, label, {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        align: "center",
      }).setOrigin(0.5).setResolution(window.devicePixelRatio);

      const textWidth = text.width;
      const textHeight = text.height;
      const btnWidth = textWidth + paddingX * 2;
      const btnHeight = textHeight + paddingY * 2;

      const bg = this.add.graphics();
      bg.fillStyle(0x222222, 1);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);

      const hitZone = this.add.zone(0, 0, btnWidth, btnHeight)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const container = this.add.container(x, y, [bg, text, hitZone])
        .setSize(btnWidth, btnHeight);

      // Hover effect
      hitZone.on("pointerover", () => {
        bg.clear();
        bg.fillStyle(0x00ffc3, 1);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);
        text.setColor("#000000");
      });

      hitZone.on("pointerout", () => {
        bg.clear();
        bg.fillStyle(0x222222, 1);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);
        text.setColor("#ffffff");
      });

      hitZone.on("pointerdown", callback);

      return container;
    }

    _openHowTo() {
      const W = this.scale.width,
        H = this.scale.height;
      const boxW = Math.min(W * 0.9, 720);
      const boxH = Math.min(H * 0.6, 360);

      const centerX = Math.round(W / 2);
      const centerY = Math.round(H / 2);

      // Dimmed background
      const blocker = this.add
        .rectangle(centerX, centerY, W, H, 0x000000, 0.6)
        .setInteractive()
        .setDepth(99);

      const panel = this.add.graphics().setDepth(100);
      panel.fillStyle(0x0a0a0a, 0.95);
      panel.lineStyle(2, 0x00ffc3, 1);
      panel.fillRoundedRect(
        centerX - boxW / 2,
        centerY - boxH / 2,
        boxW,
        boxH,
        20
      );
      panel.strokeRoundedRect(
        centerX - boxW / 2,
        centerY - boxH / 2,
        boxW,
        boxH,
        20
      );

      const content = [
        "> Match the arrow by pressing the opposite key/button within the time limit.",
        "",
        "> Score increases for each correct match, and time decreases as score increases.",
        "",
        "> Try to beat your own score and be on the leaderboard!",
        "",
        "> Different type of difficulties you will get to engage",
        "",
        "Easy: Simple (⬆️ ⬅️ ⬇️ ➡️)",
        "Medium: Diagonal (↖️ ↗️ ↙️ ↘️)",
        "Hard: Both Mixed randomly",
      ];

      const textGroup = this.add.group();
      const lineSpacing = 24;

      const textStyle = {
        fontFamily: '"Luckiest Guy", "cursive"',
        fontSize: `${Math.max(14, Math.floor(Math.min(W, H) / 40))}px`,
        color: "#ffffff",
        align: "center",
        wordWrap: { width: boxW - 40 },
      };

      const startY = centerY - boxH / 2 + 30;

      content.forEach((line, i) => {
        const lineText = this.add
          .text(centerX, Math.round(startY + i * lineSpacing), line, textStyle)
          .setOrigin(0.5)
          .setResolution(window.devicePixelRatio)
          .setDepth(101);
        textGroup.add(lineText);
      });

      // Close button
      const closeBtnWidth = 120;
      const closeBtnHeight = 40;
      const closeBtnRadius = 10;
      const closeBtnX = centerX;
      const closeBtnY = centerY + boxH / 2 - 30;

      const closeBg = this.add.graphics().setDepth(102);
      closeBg.fillStyle(0x222222, 1);
      closeBg.fillRoundedRect(
        closeBtnX - closeBtnWidth / 2,
        closeBtnY - closeBtnHeight / 2,
        closeBtnWidth,
        closeBtnHeight,
        closeBtnRadius
      );

      closeBg.setInteractive(
        new Phaser.Geom.Rectangle(
          closeBtnX - closeBtnWidth / 2,
          closeBtnY - closeBtnHeight / 2,
          closeBtnWidth,
          closeBtnHeight
        ),
        Phaser.Geom.Rectangle.Contains,
        true
      );
      closeBg.input.cursor = 'pointer';

      const closeText = this.add.text(closeBtnX, closeBtnY, "Close", {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: "18px",
        color: "#ffffff",
      }).setOrigin(0.5).setDepth(103);

      closeBg.on("pointerover", () => {
        closeBg.clear();
        closeBg.fillStyle(0x00ffc3, 1);
        closeText.setColor("#000000");
        closeBg.fillRoundedRect(
          closeBtnX - closeBtnWidth / 2,
          closeBtnY - closeBtnHeight / 2,
          closeBtnWidth,
          closeBtnHeight,
          closeBtnRadius
        );
      });
      closeBg.on("pointerout", () => {
        closeBg.clear();
        closeBg.fillStyle(0x222222, 1);
        closeText.setColor("#ffffff");
        closeBg.fillRoundedRect(
          closeBtnX - closeBtnWidth / 2,
          closeBtnY - closeBtnHeight / 2,
          closeBtnWidth,
          closeBtnHeight,
          closeBtnRadius
        );
      });

      // Click handler
      closeBg.on("pointerdown", () => {
        panel.destroy();
        textGroup.clear(true, true);
        closeBg.destroy();
        closeText.destroy();
        blocker.destroy();
      });
    }

    _setupStatsUI(W, H) {
      const x = W - 40,
        startY = H - 130;
      const labelStyle = {
        fontFamily: '"Luckiest Guy", "cursive"',
        fontSize: Math.max(12, Math.floor(Math.min(W, H) / 48)),
        color: "#fff",
      };
      const valueStyle = {
        fontFamily: '"Luckiest Guy", "cursive"',
        fontSize: Math.max(12, Math.floor(Math.min(W, H) / 48)),
        color: "#00ffc3",
      };

      // 🎮 Players
      this.visitorsLabel = this.add
        .text(x, startY, "🎮 Players: ", labelStyle)
        .setOrigin(1, 0)
        .setDepth(2);
      this.visitorsValue = this.add
        .text(x, startY, "0", valueStyle)
        .setOrigin(0, 0)
        .setDepth(2);

      // 👍 Likes
      this.likeLabel = this.add
        .text(x, startY + 28, "👍 Likes: ", labelStyle)
        .setOrigin(1, 0)
        .setDepth(2)
        .setInteractive({ useHandCursor: true })
        .setScale(1);
      this.likeValue = this.add
        .text(x, startY + 28, "0", valueStyle)
        .setOrigin(0, 0)
        .setDepth(2);

      // 👎 Dislikes
      this.dislikeLabel = this.add
        .text(x, startY + 56, "👎 Dislikes: ", labelStyle)
        .setOrigin(1, 0)
        .setDepth(2)
        .setInteractive({ useHandCursor: true })
        .setScale(1);
      this.dislikeValue = this.add
        .text(x, startY + 56, "0", valueStyle)
        .setOrigin(0, 0)
        .setDepth(2);

      // 💬 Feedback
      this.feedbackText = this.add
        .text(W - 30, startY + 88, "💬 Feedback", labelStyle)
        .setOrigin(1, 0)
        .setDepth(2)
        .setInteractive({ useHandCursor: true });

      const self = this;
      this.likeLabel.on("pointerdown", async () => {
        if (localStorage.getItem("mfd_liked") === "like") {
          this.showAlertModal("You already reacted.");
          return;
        }
        this.tweens.add({
          targets: this.likeLabel,
          scale: 1.3,
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
        });
        try {
          await fetch("https://mind-flip-dash.up.railway.app/api/like", { method: "POST" });
          localStorage.setItem("mfd_liked", "like");
          this._refreshStats();
        } catch (e) {
          console.warn(e);
          this.showAlertModal("Failed to like");
        }
      });
      this.likeLabel.on("pointerover", () =>
        this.likeLabel.setStyle({ color: "#00ffc3" })
      );
      this.likeLabel.on("pointerout", () =>
        this.likeLabel.setStyle({ color: "#ffffff" })
      );

      this.dislikeLabel.on("pointerdown", async () => {
        if (localStorage.getItem("mfd_liked") === "dislike") {
          this.showAlertModal("You already reacted.");
          return;
        }
        this.tweens.add({
          targets: this.dislikeLabel,
          scale: 1.3,
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
        });
        try {
          await fetch("https://mind-flip-dash.up.railway.app/api/dislike", { method: "POST" });
          localStorage.setItem("mfd_liked", "dislike");
          this._refreshStats();
        } catch (e) {
          console.warn(e);
          this.showAlertModal("Failed to dislike");
        }
      });
      this.dislikeLabel.on("pointerover", () =>
        this.dislikeLabel.setStyle({ color: "#00ffc3" })
      );
      this.dislikeLabel.on("pointerout", () =>
        this.dislikeLabel.setStyle({ color: "#ffffff" })
      );

      this.feedbackText.on("pointerdown", () => {
        this.showPromptModal("Send feedback (max 500 chars):", "", 500, (text) => {
          if (!text) return;

          fetch("https://mind-flip-dash.up.railway.app/api/submit-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: text }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (j.rate_limited) {
                this.showAlertModal("Please wait before submitting feedback again.");
              } else {
                this.showAlertModal("Thank you for your feedback!");
              }
            })
            .catch(() => this.showAlertModal("Failed to send feedback"));
        });
      });
      this.feedbackText.on("pointerover", () =>
        this.feedbackText.setStyle({ color: "#00ffc3" })
      );
      this.feedbackText.on("pointerout", () =>
        this.feedbackText.setStyle({ color: "#ffffff" })
      );
    }

    async _refreshStats() {
      try {
        const res = await fetch("https://mind-flip-dash.up.railway.app/api/stats");
        const j = await res.json();

        this.visitorsValue?.setText(`${j.visitors || 0}`);
        this.likeValue?.setText(`${j.likes || 0}`);
        this.dislikeValue?.setText(`${j.dislikes || 0}`);
      } catch (e) {
        console.warn("Stats fetch failed", e);
      }
    }
  }

  // DoorScene: show door animation and play door sound, then start GameScene
  class DoorScene extends BaseScene {
    constructor() {
      super("DoorScene");
    }

    init(data) {
      this.from = data.from || "MenuScene";
    }

    create() {
      const W = this.scale.width,
        H = this.scale.height;

      // Add blurred logo background
      if (this.textures.exists("logo")) {
        const s = 1; // Slightly larger for a "blurry" feel
        const a = 0.1; // Low alpha for subtle blur-like appearance

        this.add
          .image(W / 2, H / 2, "logo")
          .setScale((Math.min(W, H) / 600) * s)
          .setAlpha(a);
      } else {
        this.cameras.main.setBackgroundColor(0x0b0b0b);
      }

      // Full-size door rectangles
      const left = this.add
        .rectangle(0, 0, W / 2, H, 0x000000)
        .setOrigin(0, 0)
        .setDepth(30);
      const right = this.add
        .rectangle(W / 2, 0, W / 2, H, 0x000000)
        .setOrigin(0, 0)
        .setDepth(30);

      // play door sound if enabled
      if (SETTINGS.sfx) {
        const result = this.sound.play("doorSfx", { volume: 0.9 });
        if (result && typeof result.catch === "function") {
          result.catch(() => { });
        }
      }

      // tween doors open outward and start game
      this.tweens.add({
        targets: left,
        x: -W / 2,
        duration: 900,
        ease: "Cubic.easeInOut",
      });
      this.tweens.add({
        targets: right,
        x: W,
        duration: 900,
        ease: "Cubic.easeInOut",
        onComplete: () => {
          this.scene.stop("MenuScene"); // stop menu
          this.scene.start("GameScene", { difficulty: SETTINGS.difficulty });
        },
      });
    }
  }

  // GameScene: core gameplay
  class GameScene extends BaseScene {
    constructor() {
      super("GameScene");
    }

    init(data) {
      this.difficulty = data.difficulty || SETTINGS.difficulty || "easy";
    }

    create() {
      const W = this.scale.width,
        H = this.scale.height;

      // background subtle blurred logo copy
      if (this.textures.exists("logo")) {
        const s = 1; // Slightly larger for a "blurry" feel
        const a = 0.1; // Low alpha for subtle blur-like appearance

        this.add
          .image(W / 2, H / 2, "logo")
          .setScale((Math.min(W, H) / 600) * s)
          .setAlpha(a);
      } else {
        this.cameras.main.setBackgroundColor(0x0b0b0b);
      }

      // HUD: score + high
      this.score = 0;
      this.timerStartTime = 0;
      this.timerRunning = false;
      this.gameOver = false;
      this.baseTime = BASE_TIME;
      this.timeLimit = this.baseTime;
      this.high = parseInt(localStorage.getItem(LS.high) || "0", 10);

      this.scoreText = this.add
        .text(W / 2, 36, `🎯 Score: ${this.score}`, {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: Math.max(18, Math.floor(Math.min(W, H) / 28)),
          color: "#fff",
        })
        .setOrigin(0.5)
        .setDepth(5);
      this.highText = this.add
        .text(W / 2, 68, `💯 High Score: ${this.high}`, {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: Math.max(14, Math.floor(Math.min(W, H) / 40)),
          color: "#a6ff00",
        })
        .setOrigin(0.5)
        .setDepth(5);

      // red timer bar setup
      this.timerBarWidth = Math.min(this.scale.width * 0.8, 400); // max width of bar
      this.timerBarHeight = 8;
      this.timerBarX = (this.scale.width - this.timerBarWidth) / 2;
      this.timerBarY = this.highText.y + 40;
      this.timerBar = this.add.graphics().setDepth(6).setAlpha(1);
      this._updateTimerBar(1); // show full bar initially

      // central arrow (SVG)
      const arrowSize = Math.max(46, Math.floor(Math.min(W, H) / 6));
      this.arrow = this.add
        .image(W / 2, H / 2 - arrowSize * 0.8, "arrow_up")
        .setOrigin(0.5)
        .setDepth(5)
        .setTint(0xffee58);

      const arrowScale = Math.min(
        0.9,
        arrowSize / Math.max(this.arrow.width, this.arrow.height)
      );
      this.arrow.setScale(arrowScale);
      this.arrowBaseScale = arrowScale;

      // sounds
      this.success = this.sound.add("successSfx");
      this.fail = this.sound.add("failSfx");
      // background music reference (menu bg)
      const menuScene = this.scene.get("MenuScene");
      this.bgMusic =
        menuScene && menuScene.bg
          ? menuScene.bg
          : this.sound.add("bgMusic", { loop: true, volume: 0.35 });

      // start music if enabled
      if (SETTINGS.music) {
        if (!this.bgMusic.isPlaying) {
          const result = this.bgMusic.play();
          if (result && typeof result.catch === "function") {
            result.catch(() => { });
          }
        }
      }

      // Delay first arrow so timer works correctly
      this.time.delayedCall(0, () => {
        this._nextArrow();
      });

      // keyboard
      this.input.keyboard.on("keydown", (e) => {
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
        ) {
          this._handleInput(e.code);
        }
      });

      // touch controls (fade-in)
      this._createTouchControls();
    }

    _makeModalRoundedButton(x, y, label, callback) {
      const fontSize = 16;
      const paddingX = 28;
      const paddingY = 12;
      const radius = 10;

      // Create text
      const text = this.add.text(0, 0, label, {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        align: "center",
      }).setOrigin(0.5).setResolution(window.devicePixelRatio);

      const textWidth = text.width;
      const textHeight = text.height;
      const btnWidth = textWidth + paddingX * 2;
      const btnHeight = textHeight + paddingY * 2;

      // Button background
      const bg = this.add.graphics();
      bg.fillStyle(0x222222, 1);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);

      // Create hit area
      const hitZone = this.add.zone(0, 0, btnWidth, btnHeight)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const container = this.add.container(x, y, [bg, text, hitZone])
        .setSize(btnWidth, btnHeight)
        .setDepth(100);

      // Hover effect
      hitZone.on("pointerover", () => {
        bg.clear();
        bg.fillStyle(0x00ffc3, 1);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);
        text.setColor("#000000");
      });

      hitZone.on("pointerout", () => {
        bg.clear();
        bg.fillStyle(0x222222, 1);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);
        text.setColor("#ffffff");
      });

      hitZone.on("pointerdown", callback);

      return container;
    }

    _nextArrow() {
      // set currentDir based on difficulty
      const cardinals = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
      const diagonals = ["NE", "NW", "SE", "SW"];

      if (this.difficulty === "easy") {
        this.currentDir = Phaser.Utils.Array.GetRandom(cardinals);
      } else if (this.difficulty === "medium") {
        this.currentDir = Phaser.Utils.Array.GetRandom(diagonals);
      } else {
        // hard: 50% cardinal, 50% diagonal
        this.currentDir =
          Math.random() < 0.5
            ? Phaser.Utils.Array.GetRandom(cardinals)
            : Phaser.Utils.Array.GetRandom(diagonals);
      }

      // set symbol
      const arrowTextureMap = {
        ArrowUp: "arrow_up",
        ArrowDown: "arrow_down",
        ArrowLeft: "arrow_left",
        ArrowRight: "arrow_right",
        NE: "arrow_ne",
        NW: "arrow_nw",
        SE: "arrow_se",
        SW: "arrow_sw",
      };
      this.arrow.setTexture(arrowTextureMap[this.currentDir] || "arrow_up");

      // compute new time limit
      this.timeLimit = Math.max(
        MIN_TIME,
        this.baseTime - Math.floor(this.score / 5) * DECREASE_PER_5
      );

      this.timerStartTime = this.time.now;
      this.timerRunning = true;
      this._updateTimerBar(1); // full width initially

      // clear any old timer update
      if (this.timerEvent) this.timerEvent.remove(false);

      // reset failure timer
      if (this.failTimer) this.failTimer.remove(false);

      // small pop animation
      this.tweens.add({
        targets: this.arrow,
        scale: {
          from: this.arrowBaseScale * 0.94,
          to: this.arrowBaseScale * 1.02,
        },
        duration: 120,
        yoyo: true,
      });
    }

    _handleInput(key) {
      // determine success or fail
      const opposite = {
        ArrowUp: "ArrowDown",
        ArrowDown: "ArrowUp",
        ArrowLeft: "ArrowRight",
        ArrowRight: "ArrowLeft",
      };
      const diagOpp = { NE: "SW", NW: "SE", SE: "NW", SW: "NE" };
      // for diagonals accept either axis of opposite diagonal for ease on mobile (single-key)
      const diagAxisMap = {
        NE: ["ArrowRight", "ArrowUp"],
        NW: ["ArrowLeft", "ArrowUp"],
        SE: ["ArrowRight", "ArrowDown"],
        SW: ["ArrowLeft", "ArrowDown"],
      };
      let ok = false;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          this.currentDir
        )
      ) {
        ok = key === opposite[this.currentDir];
      } else {
        // current is diagonal: check opposite diagonal's axis keys
        const oppDiag = diagOpp[this.currentDir];
        const accepted = diagAxisMap[oppDiag] || [];
        ok = accepted.includes(key);
      }

      if (ok) {
        // Stop timer bar update
        if (this.timerEvent) this.timerEvent.remove(false);
        // success
        if (SETTINGS.sfx) {
          try {
            this.success.play();
          } catch (e) { }
        }
        this.score++;
        this.scoreText.setText(`🎯 Score: ${this.score}`);
        if (this.score > this.high) {
          this.high = this.score;
          localStorage.setItem(LS.high, String(this.high));
          this.highText.setText(`💯 High Score: ${this.high}`);
        }
        // next arrow after tiny delay
        this.time.delayedCall(80, () => this._nextArrow());
      } else {
        // fail
        if (SETTINGS.sfx) {
          try {
            this.fail.play();
          } catch (e) { }
        }
        this._onFail();
      }
    }

    _updateTimerBar(progress) {
      this.timerBar.clear();

      // Background (gray)
      this.timerBar.fillStyle(0x333333, 0.5);
      this.timerBar.fillRect(
        this.timerBarX,
        this.timerBarY,
        this.timerBarWidth,
        this.timerBarHeight
      );

      // Foreground (shrinking red bar)
      const barWidth = this.timerBarWidth * Phaser.Math.Clamp(progress, 0, 1);
      this.timerBar.fillStyle(0xff0033, 1);
      this.timerBar.fillRect(
        this.timerBarX,
        this.timerBarY,
        barWidth,
        this.timerBarHeight
      );
    }

    update() {
      if (this.timerRunning && !this.gameOver) {
        const elapsed = this.time.now - this.timerStartTime;
        const progress = Phaser.Math.Clamp(1 - elapsed / this.timeLimit, 0, 1);

        // Flash warning if time left < 500ms
        if (this.timeLimit - elapsed <= 500) {
          const flash = Math.floor(this.time.now / 100) % 2 === 0;
          this.timerBar.setVisible(flash);
        } else {
          this.timerBar.setVisible(true);
        }

        this._updateTimerBar(progress);

        if (elapsed >= this.timeLimit) {
          this.timerRunning = false;
          this._onFail();
        }
      }
    }

    destroyGameOverModal() {
      this.panel?.destroy();
      this.msg?.destroy();
      this.scoreText?.destroy();
      this.restartBtn?.destroy();
      this.exitBtn?.destroy();
      this.submitBtn?.destroy();
      this.inputBlocker?.destroy();
    }

    _onFail() {
      this.gameOver = true;
      this.timerRunning = false;
      this.tweens.add({
        targets: this.timerBar,
        alpha: 0,
        duration: 400,
        ease: "Power2",
      });

      if (this.failTimer) this.failTimer.remove(false);
      if (this.timerEvent) this.timerEvent.remove(false);

      // pause background music if it’s playing
      const bg = this.sound.get("bgMusic");
      if (bg && bg.isPlaying) {
        bg.stop();
      }

      // play fail / fall sound if enabled
      if (SETTINGS.sfx) {
        const fail = this.sound.add("failSfx", { volume: 0.9 });
        if (fail) {
          const result = fail.play();
          if (result && typeof result.catch === "function") {
            result.catch(() => { });
          }
        }
      }

      // show Game Over modal inside Phaser
      const W = this.scale.width,
        H = this.scale.height;
      const boxW = Math.min(W * 0.86, 520),
        boxH = Math.min(H * 0.46, 320);

      this.inputBlocker = this.add
        .rectangle(W / 2, H / 2, W, H, 0x000000, 0.001) // almost invisible
        .setInteractive()
        .setDepth(98);

      this.panel = this.add.graphics().setDepth(99);
      this.panel.fillStyle(0x121212, 0.98);
      this.panel.lineStyle(2, 0x00ffc3, 1);
      this.panel.fillRoundedRect(W / 2 - boxW / 2, H / 2 - boxH / 2, boxW, boxH, 18);
      this.panel.strokeRoundedRect(W / 2 - boxW / 2, H / 2 - boxH / 2, boxW, boxH, 18);

      this.msg = this.add
        .text(W / 2, H / 2 - 80, "💥 Game Over!", {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: Math.max(20, Math.floor(Math.min(W, H) / 22)),
          color: "#fff",
        })
        .setOrigin(0.5)
        .setDepth(100);

      this.scoreText = this.add
        .text(W / 2 + 15, H / 2 - 30, `Your Score: ${this.score}`, {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: Math.max(16, Math.floor(Math.min(W, H) / 28)),
          color: "#ddd",
        })
        .setOrigin(0.5)
        .setDepth(100);

      this.restartBtn = this._makeModalRoundedButton(W / 2 - 120, H / 2 + 30, "🔁 Restart", () => {
        this.destroyGameOverModal();
        this.scene.start("GameScene");
      });

      this.exitBtn = this._makeModalRoundedButton(W / 2 + 120, H / 2 + 30, "🚪 Exit", () => {
        this.destroyGameOverModal();
        this.scene.start("MenuScene");
      });

      this.submitBtn = this._makeModalRoundedButton(W / 2, H / 2 + 90, "🏁 Submit Score", () => {
        this.showPromptModal("Enter name for leaderboard (max 20 chars):", "Player", 20, (name) => {
          if (!name) return;

          fetch("https://mind-flip-dash.up.railway.app/submit-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), score: this.score }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success") {
                this.showAlertModal("🎉Score submitted!", {
                  onClose: () => {
                    console.log("✅ Score submitted modal dismissed.");
                    this.destroyGameOverModal();
                    this.scene.start("MenuScene");
                  },
                });
              } else {
                this.showAlertModal(j.message || "❌ Submission failed");
              }
            })
            .catch(() => {
              this.showAlertModal("⚠️ Network error. Please try again.");
            });
        });
      });
      this.timerBar.clear();
    }

    _createTouchControls() {
      const W = this.scale.width,
        H = this.scale.height;
      const base = Math.max(46, Math.floor(Math.min(W, H) / 8));
      const centerX = W / 2,
        bottomY = H - base - 40;
      const gap = base + 30;

      const useImg = this.textures.exists("arrow_up");

      const createBtn = (x, y, keyName, inputKey) => {
        // border box behind button
        const box = this.add
          .rectangle(x, y, base + 20, base + 20)
          .setOrigin(0.5)
          .setAlpha(0) // fade in later
          .setDepth(9)
          .setInteractive({ useHandCursor: true });

        let btn;
        if (useImg) {
          btn = this.add.image(x, y, keyName).setAlpha(0).setDepth(10);
          const scale = Math.min(0.9, base / Math.max(btn.width, btn.height));
          btn.setScale(scale);
        } else {
          btn = this.add
            .text(
              x,
              y,
              inputKey === "ArrowUp"
                ? "↑"
                : inputKey === "ArrowDown"
                  ? "↓"
                  : inputKey === "ArrowLeft"
                    ? "←"
                    : "→",
              {
                fontFamily: '"Luckiest Guy", "cursive"',
                fontSize: Math.max(18, Math.floor(base / 2)),
                color: "#00ffc3",
              }
            )
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(10);
        }

        // click/touch
        box.on("pointerdown", () => {
          this._handleInput(inputKey);
          // press effect
          this.tweens.add({
            targets: btn,
            scale: 0.52,
            duration: 90,
            yoyo: true,
          });
        });

        // hover effects
        box.on("pointerover", () => box.setStrokeStyle(3, 0x00cc9e));
        box.on("pointerout", () => box.setStrokeStyle(3, 0x00ffc3));

        // fade in
        this.tweens.add({
          targets: [box, btn],
          alpha: 1,
          duration: 420,
          delay: 160,
        });

        return { box, btn };
      };

      // Create: left, down, up, right
      createBtn(centerX - gap, bottomY, "arrow_left", "ArrowLeft");
      createBtn(centerX, bottomY, "arrow_down", "ArrowDown");
      createBtn(centerX, bottomY - gap, "arrow_up", "ArrowUp");
      createBtn(centerX + gap, bottomY, "arrow_right", "ArrowRight");
    }
  }

  // LeaderboardScene: fetch and display
  class LeaderboardScene extends BaseScene {
    constructor() {
      super("LeaderboardScene");
    }

    create() {
      const W = this.scale.width;
      const H = this.scale.height;

      // Background logo
      if (this.textures.exists("logo")) {
        const s = 1;
        const a = 0.1;
        this.add
          .image(W / 2, H / 2, "logo")
          .setScale((Math.min(W, H) / 600) * s)
          .setAlpha(a);
      } else {
        this.cameras.main.setBackgroundColor(0x0b0b0b);
      }

      // Title
      this.add
        .text(W / 2, 48, "🏆 Leaderboard", {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: Math.max(20, Math.floor(Math.min(W, H) / 22)),
          color: "#00ffc3",
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio);

      // const boxW = Math.min(W * 0.86, 700);
      const startY = 110;
      const rowH = Math.max(20, Math.floor(Math.min(W, H) / 24));

      const loading = this.add
        .text(W / 2, H / 2, "Loading...", {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize: 18,
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio);

      fetch("https://mind-flip-dash.up.railway.app/leaderboard")
        .then((r) => r.json())
        .then((data) => {
          loading.destroy();

          let normalized = [];
          if (Array.isArray(data) && data.length > 0) {
            if (typeof data[0] === "object" && data[0].name !== undefined) {
              normalized = data;
            } else {
              normalized = data.map((item) =>
                Array.isArray(item) ? { name: item[0], score: item[1] } : item
              );
            }
          }

          normalized.slice(0, 10).forEach((row, i) => {
            const y = startY + i * (rowH + 8);

            this.add
              .text(W / 2 - 160, y, `${i + 1}.`, {
                fontFamily: '"Luckiest Guy", "cursive"',
                fontSize: rowH,
                color: "#fff",
              })
              .setOrigin(0, 0.5)
              .setResolution(window.devicePixelRatio);

            this.add
              .text(W / 2 - 120, y, String(row.name), {
                fontFamily: '"Luckiest Guy", "cursive"',
                fontSize: rowH,
                color: "#fff",
              })
              .setOrigin(0, 0.5)
              .setResolution(window.devicePixelRatio);

            this.add
              .text(W / 2 + 160, y, String(row.score), {
                fontFamily: '"Luckiest Guy", "cursive"',
                fontSize: rowH,
                color: "#a6ff00",
              })
              .setOrigin(1, 0.5)
              .setResolution(window.devicePixelRatio);
          });

          if (normalized.length === 0) {
            this.add
              .text(W / 2, H / 2, "No leaderboard entries yet", {
                fontFamily: '"Luckiest Guy", "cursive"',
                fontSize: 16,
                color: "#ddd",
              })
              .setOrigin(0.5)
              .setResolution(window.devicePixelRatio);
          }
        })
        .catch((e) => {
          loading.setText("Failed to load leaderboard");
          console.warn(e);
        });

      // Rounded "Back" Button
      const btnText = "Back";
      const fontSize = 18;
      const padding = { x: 18, y: 10 };
      const btnY = H - 56;

      const tempText = this.add
        .text(0, 0, btnText, {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize,
        })
        .setVisible(false);

      const textMetrics = tempText.getBounds();
      const btnWidth = textMetrics.width + padding.x * 2;
      const btnHeight = textMetrics.height + padding.y * 2;
      tempText.destroy();

      const backBtnX = W / 2;

      // Rounded background for button
      const backBtnBg = this.add.graphics().setDepth(10);
      const drawBackButton = (color = 0x222222) => {
        backBtnBg.clear();
        backBtnBg.fillStyle(color, 1);
        backBtnBg.fillRoundedRect(
          backBtnX - btnWidth / 2,
          btnY - btnHeight / 2,
          btnWidth,
          btnHeight,
          12
        );
      };
      drawBackButton();

      // Actual button text
      const backText = this.add
        .text(backBtnX, btnY, btnText, {
          fontFamily: '"Luckiest Guy", "cursive"',
          fontSize,
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setResolution(window.devicePixelRatio);

      // Interactivity area
      backBtnBg.setInteractive(
        new Phaser.Geom.Rectangle(
          backBtnX - btnWidth / 2,
          btnY - btnHeight / 2,
          btnWidth,
          btnHeight
        ),
        Phaser.Geom.Rectangle.Contains
      );
      backBtnBg.input.cursor = "pointer";

      backBtnBg.on("pointerover", () => {
        drawBackButton(0x00ffc3);
        backText.setColor("#000");
      });
      backBtnBg.on("pointerout", () => {
        drawBackButton(0x222222);
        backText.setColor("#fff");
      });
      backBtnBg.on("pointerdown", () => {
        this.scene.start("MenuScene");
      });
    }
  }

  // SettingsScene
  class SettingsScene extends BaseScene {
    constructor() {
      super("SettingsScene");
    }

    create() {
      const W = this.scale.width,
        H = this.scale.height;
      // faint bg logo
      if (this.textures.exists("logo")) {
        const s = 1; // Slightly larger for a "blurry" feel
        const a = 0.1; // Low alpha for subtle blur-like appearance

        this.add
          .image(W / 2, H / 2, "logo")
          .setScale((Math.min(W, H) / 600) * s)
          .setAlpha(a);
      } else {
        this.cameras.main.setBackgroundColor(0x0b0b0b);
      }

      // Title
      this._makeLabel(W / 2, 60, "⚙️ Settings", {
        fontFamily: '"Luckiest Guy", "cursive"',
        fontSize: Math.max(18, Math.floor(Math.min(W, H) / 22)),
        color: "#00ffc3",
      });

      const spacing = 80;
      let startY = 130;

      // Difficulty
      const diffBtn = this._makeVectorButton(
        W / 2,
        startY,
        `Difficulty: ${SETTINGS.difficulty.toUpperCase()}`,
        () => {
          SETTINGS.difficulty =
            SETTINGS.difficulty === "easy"
              ? "medium"
              : SETTINGS.difficulty === "medium"
                ? "hard"
                : "easy";
          diffBtn
            .getByName("label")
            .setText(`Difficulty: ${SETTINGS.difficulty.toUpperCase()}`);
          localStorage.setItem(LS.difficulty, SETTINGS.difficulty);
        }
      );

      // Music Toggle
      const musicBtn = this._makeVectorButton(
        W / 2,
        startY + spacing,
        `Music: ${SETTINGS.music ? "On" : "Off"}`,
        () => {
          SETTINGS.music = !SETTINGS.music;
          musicBtn
            .getByName("label")
            .setText(`Music: ${SETTINGS.music ? "On" : "Off"}`);
          localStorage.setItem(LS.music, SETTINGS.music ? "true" : "false");
          const menu = this.scene.get("MenuScene");
          if (menu && menu.bg) {
            if (SETTINGS.music) {
              const result = menu.bg.play();
              if (result && typeof result.catch === "function") {
                result.catch(() => {});
              }
            } else {
              menu.bg.pause();
            }
          }

        }
      );

      // SFX Toggle
      const sfxBtn = this._makeVectorButton(
        W / 2,
        startY + spacing * 2,
        `SFX: ${SETTINGS.sfx ? "On" : "Off"}`,
        () => {
          SETTINGS.sfx = !SETTINGS.sfx;
          sfxBtn
            .getByName("label")
            .setText(`SFX: ${SETTINGS.sfx ? "On" : "Off"}`);
          localStorage.setItem(LS.sfx, SETTINGS.sfx ? "true" : "false");
        }
      );

      // Back
      this._makeVectorButton(W / 2, H - 60, "Back", () => {
        this.scene.start("MenuScene");
      });
    }

    _makeLabel(x, y, text, style) {
      const label = this.add
        .text(x, y, text, {
          ...style,
          align: "center",
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio)
        .setDepth(10);
      return label;
    }

    _makeVectorButton(x, y, labelText, onClick, options = {}) {
      const paddingX = options.paddingX || 20;
      const paddingY = options.paddingY || 12;
      const bgColor = options.bgColor || 0x222222;
      const hoverColor = options.hoverColor || 0x00ffc3;
      const textColor = options.textColor || "#ffffff";
      const hoverTextColor = options.hoverTextColor || "#000000";
      const fontSize = options.fontSize || 16;
      const radius = options.radius || 8;
      const fontFamily = options.fontFamily || '"Luckiest Guy", "cursive"';

      // Create text
      const label = this.add
        .text(0, 0, labelText, {
          fontFamily,
          fontSize,
          color: textColor,
        })
        .setOrigin(0.5)
        .setName("label")
        .setResolution(window.devicePixelRatio);

      const width = label.width + paddingX * 2;
      const height = label.height + paddingY * 2;

      // Create graphics background
      const bg = this.add.graphics({ name: "bg" });
      bg.fillStyle(bgColor, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

      // Create invisible hit zone
      const hitZone = this.add
        .zone(0, 0, width, height)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // Create container and add all
      const container = this.add.container(x, y, [bg, label, hitZone]);

      // Enable pointer events
      hitZone.on("pointerover", () => {
        bg.clear();
        bg.fillStyle(hoverColor, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        label.setColor(hoverTextColor);
      });

      hitZone.on("pointerout", () => {
        bg.clear();
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        label.setColor(textColor);
      });

      hitZone.on("pointerdown", () => {
        onClick?.();
      });

      return container;
    }
  }

  // instantiate game
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    dom: {
      createContainer: true
    },
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0b0b0b,
    physics: {
      default: 'arcade'
    },
    scene: [
      BootScene,
      MenuScene,
      DoorScene,
      GameScene,
      LeaderboardScene,
      SettingsScene,
    ],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent: "gameDiv"
    },
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: false,
    },
    audio: {
      disableWebAudio: false,
    },
  });

  // ensure canvas resizes nicely on window resize
  window.addEventListener("resize", () => {
    if (game && game.scale)
      game.scale.resize(window.innerWidth, window.innerHeight);
  });

  // mobile autoplay: start bg music on first global pointerdown if needed
  const startMusicOnFirstGesture = () => {
    if (SETTINGS.music) {
      try {
        const m =
          game.scene &&
          game.scene.getScene("MenuScene") &&
          game.scene.getScene("MenuScene").bg;
        if (m && !m.isPlaying) m.play().catch(() => { });
      } catch (e) { }
    }
    // remove listener after first gesture
    window.removeEventListener("pointerdown", startMusicOnFirstGesture);
  };
  window.addEventListener("pointerdown", startMusicOnFirstGesture);
})();
