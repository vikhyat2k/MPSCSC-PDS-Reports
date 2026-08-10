
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { Jimp } = require('jimp');

/**
 * Main Scraper Class for MP SCM Portal
 * Handles automated login and data extraction
 */
class SCMScraper {
  constructor() {
    this.VERSION = '1.0.5'; // Bump version
    this.browser = null;
    this.page = null;
    this.ocrWorker = null;
    const rawURL = process.env.SCM_URL || 'https://scm.mp.gov.in/Login.jsp';
    // Standardize to origin if provided as just domain, or keep as is if it includes path
    this.baseURL = rawURL.endsWith('.jsp') ? rawURL : `${rawURL}/Login.jsp`.replace('//Login.jsp', '/Login.jsp');
    this.baseDomain = this.baseURL.replace('/Login.jsp', '');

    // Create logs directory if it doesn't exist
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log('✅ Created logs directory');
    }
  }

  // ... (init method remains same)

  /**
   * Attempt automatic CAPTCHA solving using Tesseract.js
   * Returns true if successful, false otherwise
   */
  /**
   * Helper to solve CAPTCHA using 2Captcha API
   */
  async solveWith2Captcha(base64Image) {
    const apiKey = process.env.TWOCAPTCHA_API_KEY;
    if (!apiKey) return null;

    console.log('   🔄 Sending CAPTCHA to 2Captcha API...');
    try {
      const submitRes = await fetch('https://2captcha.com/in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey, method: 'base64', body: base64Image, json: 1 })
      });
      const submitData = await submitRes.json();
      
      if (submitData.status !== 1) {
        console.error('   ❌ 2Captcha Error:', submitData.request);
        return null;
      }
      
      const captchaId = submitData.request;
      console.log(`   ⏳ CAPTCHA submitted. ID: ${captchaId}. Waiting for solution...`);
      
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
        const pollData = await pollRes.json();
        
        if (pollData.status === 1) {
          console.log(`   ✅ 2Captcha Solved: "${pollData.request}"`);
          return pollData.request;
        } else if (pollData.request !== 'CAPCHA_NOT_READY') {
          console.error('   ❌ 2Captcha Polling Error:', pollData.request);
          return null;
        }
      }
      
      console.log('   ⚠️ 2Captcha Timed out waiting for solution.');
      return null;
    } catch (err) {
      console.error('   ❌ 2Captcha Exception:', err.message);
      return null;
    }
  }

  /**
   * Attempt automatic CAPTCHA solving using Tesseract.js or 2Captcha
   * Returns true if successful, false otherwise
   */
  async attemptAutoCaptcha(maxAttempts = 12, onProgress = null) {
    if (this.isHeadless) {
      maxAttempts = Math.min(maxAttempts, 12); // Cap attempts to 12 in headless mode (~2 min max)
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🤖 Auto-CAPTCHA Attempt ${attempt}/${maxAttempts}...`);
        if (typeof onProgress === 'function') {
          onProgress(`Logging in... Solving CAPTCHA (attempt ${attempt}/${maxAttempts})`);
        }

        // 1. Find the CAPTCHA image element
        const captchaElement = await this.page.$(
          '#captcha_img, img[src*="captcha"], img[src*="Captcha"], img[alt*="captcha"]'
        );

        if (!captchaElement) {
          console.log('⚠️ Could not find CAPTCHA image element');
          // DIAGNOSTIC: dump every <img> and every id/class containing "captcha" on the page
          try {
            const debugInfo = await this.page.evaluate(() => {
              const imgs = Array.from(document.querySelectorAll('img')).map(img => ({
                id: img.id, className: img.className, src: img.src, alt: img.alt
              }));
              const captchaLike = Array.from(document.querySelectorAll('[id*="aptcha" i], [class*="aptcha" i]')).map(el => ({
                tag: el.tagName, id: el.id, className: el.className
              }));
              return { imgs, captchaLike };
            });
            console.log('🔍 DIAGNOSTIC — all <img> tags on page:', JSON.stringify(debugInfo.imgs, null, 2));
            console.log('🔍 DIAGNOSTIC — elements with "captcha" in id/class:', JSON.stringify(debugInfo.captchaLike, null, 2));
          } catch (diagErr) {
            console.log('   (diagnostic dump failed:', diagErr.message, ')');
          }
          return false;
        }

        // 2. Screenshot just the CAPTCHA element (raw buffer)
        const rawBuffer = await captchaElement.screenshot({ type: 'png' });

        // 3. Preprocess with Jimp v1: upscale 3x, manual grayscale + threshold binarize
        console.log('   🖼️ Preprocessing CAPTCHA image with Jimp...');
        const jimpImg = await Jimp.read(Buffer.from(rawBuffer));
        const w = jimpImg.width;
        const h = jimpImg.height;
        jimpImg.resize({ w: w * 3, h: h * 3 });

        // Manual grayscale + adaptive thresholding per attempt (binary black/white) via scan
        const thresholdList = [140, 160, 120, 150, 170, 130, 180, 110];
        const currentThresh = thresholdList[(attempt - 1) % thresholdList.length];

        jimpImg.scan(function(x, y, idx) {
          const r = this.bitmap.data[idx];
          const g = this.bitmap.data[idx + 1];
          const b = this.bitmap.data[idx + 2];
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          const bin = gray < currentThresh ? 0 : 255;
          this.bitmap.data[idx]     = bin;
          this.bitmap.data[idx + 1] = bin;
          this.bitmap.data[idx + 2] = bin;
        });

        const processedBuffer = await jimpImg.getBuffer('image/png');
        
        // Debug: save the processed CAPTCHA image
        const debugPath = path.join(this.logsDir, `captcha_processed_${attempt}.png`);
        fs.writeFileSync(debugPath, processedBuffer);
        console.log(`   📁 Saved processed CAPTCHA: ${debugPath}`);

        let bestResult = '';

        if (process.env.TWOCAPTCHA_API_KEY) {
          // Use 2Captcha if API key is provided
          const base64Image = processedBuffer.toString('base64');
          bestResult = await this.solveWith2Captcha(base64Image);
        }

        if (!bestResult) {
          // Fallback to Tesseract
          console.log('   🖼️ Falling back to Tesseract OCR...');
          const psmModes = ['7', '8', '6']; // Single line, Single word, Uniform block

          if (!this.ocrWorker) {
            try {
              console.log('   ⚙️ Initializing local Tesseract worker...');
              this.ocrWorker = await Tesseract.createWorker('eng', 1, {
                langPath: path.join(__dirname, '../tessdata'),
                cachePath: path.join(__dirname, '../tessdata'),
                cacheMethod: 'none',
                gzip: false
              });
            } catch (workerErr) {
              console.error('   ❌ Failed to initialize Tesseract worker (missing eng.traineddata?):', workerErr.message);
              return false;
            }
          }

          let bestConfidence = -1;

          for (const psm of psmModes) {
            await this.ocrWorker.setParameters({
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
              tessedit_pageseg_mode: psm
            });
            const { data } = await this.ocrWorker.recognize(processedBuffer);
            const cleaned = data.text.replace(/[^a-zA-Z0-9]/g, '').trim();
            console.log(`   OCR PSM${psm}: "${cleaned}" (Conf: ${data.confidence})`);
            
            if (cleaned.length >= 4 && cleaned.length <= 8 && data.confidence > bestConfidence) {
              bestResult = cleaned;
              bestConfidence = data.confidence;
            }
          }

          // If no ideal result, use PSM7
          if (!bestResult) {
            await this.ocrWorker.setParameters({
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
              tessedit_pageseg_mode: '7',
            });
            const { data } = await this.ocrWorker.recognize(processedBuffer);
            bestResult = data.text.replace(/[^a-zA-Z0-9]/g, '').trim();
          }
          console.log(`   ✅ Final OCR Result: "${bestResult}"`);
        }

        if (!bestResult || bestResult.length < 3) {
          console.log('⚠️ OCR result too short, reloading page for fresh CAPTCHA...');
          try {
            await this.page.goto(this.baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.fillFieldReliably(
              ['input[name="userName"]', 'input[name="username"]', 'input[type="text"]'],
              process.env.SCM_USERNAME || '', 'Username'
            );
            await this.fillFieldReliably(
              ['input[name="password"]', 'input[type="password"]'],
              process.env.SCM_PASSWORD || '', 'Password'
            );
          } catch (reloadErr) {
            console.log('   ⚠️ Page reload failed:', reloadErr.message);
          }
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        // 5. Enter CAPTCHA into input field
        const captchaInput = await this.page.$(
          'input[name="captcha"], #captcha, input[id*="aptcha"], input[placeholder*="aptch"]'
        );

        if (!captchaInput) {
          console.log('⚠️ Could not find CAPTCHA input field');
          return false;
        }

        await captchaInput.click({ clickCount: 3 });
        await captchaInput.type(bestResult, { delay: 80 });
        console.log(`   ⌨️ Typed CAPTCHA: "${bestResult}"`);

        // 6. Click Login/Submit button (#lobtn is the actual login button on Login.jsp)
        const submitBtn = await this.page.$(
          '#lobtn, input[name="lobtn"], input[value="Login"]'
        );

        if (!submitBtn) {
          console.log('⚠️ Could not find submit button, pressing Enter...');
          await this.page.keyboard.press('Enter');
        } else {
          const navPromise = this.page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: 30000
          }).catch(() => null);
          await submitBtn.click();
          await navPromise;
        }

        // 7. Check if login succeeded
        const isLoggedIn = await this.verifyLogin();
        if (isLoggedIn) {
          console.log('✅ Auto-CAPTCHA Login Successful!');
          return true;
        }

        // Generate candidate variants for common OCR confusables before submitting
        const generateVariants = (s) => {
          const variants = new Set([s]);
          // Common OCR confusables: e↔6, o↔0, l↔1, I↔l, S↔5, B↔8
          const maps = [
            { from: /e/g, to: '6' }, { from: /6/g, to: 'e' },
            { from: /o/gi, to: '0' }, { from: /0/g, to: 'o' },
            { from: /l/g, to: '1' }, { from: /1/g, to: 'l' },
            { from: /I/g, to: 'l' }, { from: /S/g, to: '5' },
            { from: /5/g, to: 'S' }, { from: /B/g, to: '8' },
          ];
          maps.forEach(({ from, to }) => variants.add(s.replace(from, to)));
          return [...variants].filter(v => v.length >= 3);
        };

        const candidates = generateVariants(bestResult);
        console.log(`   🔄 Will try ${candidates.length} variants: ${candidates.join(', ')}`);

        let loginSuccess = false;
        for (const candidate of candidates) {
          // Re-find input each time (page may have reloaded on failed attempt)
          const captchaInput2 = await this.page.$(
            'input[name="captcha"], #captcha, input[id*="aptcha"], input[placeholder*="aptch"]'
          ).catch(() => null);
          if (!captchaInput2) break;

          // The portal sometimes wipes the username/password fields (not just the
          // CAPTCHA) after a failed submit — this is what actually triggers the
          // "Please Enter User Name" alert, not typing speed. Check and refill
          // before resubmitting instead of assuming they survived.
          const userStillFilled = await this.page.evaluate(() => {
            const el = document.querySelector('input[name="userName"], input[name="username"], input[type="text"]');
            return !!(el && el.value && el.value.trim().length > 0);
          }).catch(() => false);

          if (!userStillFilled) {
            console.log('   🔁 Username/password field was cleared by the portal — refilling before retry...');
            await this.fillFieldReliably(
              ['input[name="userName"]', 'input[name="username"]', 'input[type="text"]'],
              process.env.SCM_USERNAME || '', 'Username'
            );
            await this.fillFieldReliably(
              ['input[name="password"]', 'input[type="password"]'],
              process.env.SCM_PASSWORD || '', 'Password'
            );
          }

          await captchaInput2.click({ clickCount: 3 });
          await captchaInput2.type(candidate, { delay: 80 });
          console.log(`   ⌨️ Trying variant: "${candidate}"`);

          const submitBtn2 = await this.page.$(
            '#lobtn, input[name="lobtn"], input[value="Login"]'
          ).catch(() => null);
          if (!submitBtn2) {
            await this.page.keyboard.press('Enter');
          } else {
            const navPromise = this.page.waitForNavigation({
              waitUntil: 'domcontentloaded', timeout: 30000
            }).catch(() => null);
            await submitBtn2.click();
            await navPromise;
          }

          loginSuccess = await this.verifyLogin();
          if (loginSuccess) {
            console.log(`✅ Auto-CAPTCHA Login Successful with variant: "${candidate}"`);
            return true;
          }

          // If wrong, portal stays on login page with new CAPTCHA — break variant loop
          // and let the outer attempt loop get the new CAPTCHA
          console.log(`   ❌ Variant "${candidate}" failed.`);
          break; // Portal generates new CAPTCHA after each submit — stop variant loop
        }

        if (!loginSuccess) {
          console.log('❌ All variants failed. Reloading login page for fresh CAPTCHA...');
          try {
            await this.page.goto(this.baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Re-enter credentials
            await this.fillFieldReliably(
              ['input[name="userName"]', 'input[name="username"]', 'input[type="text"]'],
              process.env.SCM_USERNAME || '', 'Username'
            );
            await this.fillFieldReliably(
              ['input[name="password"]', 'input[type="password"]'],
              process.env.SCM_PASSWORD || '', 'Password'
            );
          } catch (reloadErr) {
            console.log('   ⚠️ Page reload failed:', reloadErr.message);
          }
          await new Promise(r => setTimeout(r, 1500));
        }

      } catch (error) {
        console.error(`   Auto CAPTCHA error (Attempt ${attempt}):`, error.message);
        if (await this.verifyLogin().catch(() => false)) return true;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return false;
  }
  /**
   * Initialize browser and page
   */
  async init(headless = null, existingBrowser = null) {
    if (existingBrowser) {
      this.browser = existingBrowser;
      this.isHeadless = false; // Assume existing browser is visible/debuggable
      console.log('🔄 Using existing browser instance');
    } else {
      if (headless === null) {
        headless = process.env.HEADLESS_MODE === 'true' || process.env.HEADLESS_MODE === undefined;
      }
      this.isHeadless = headless;

      console.log(`🚀 Launching browser (Headless: ${headless})...`);
      this.browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--hide-scrollbars',
          '--mute-audio',
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors'
        ],
        defaultViewport: { width: 1366, height: 768 },
        protocolTimeout: 300000 // 5 minutes timeout for CDP connections
      });
    }

    this.page = await this.browser.newPage();
    
    // Auto-dismiss any javascript alerts to prevent Puppeteer from hanging (crucial for invalid CAPTCHA alerts)
    this.page.on('dialog', async dialog => {
      console.log('⚠️ Handled alert dialog:', dialog.message());
      await dialog.accept().catch(() => {});
    });
    
    // Set a modern User-Agent to avoid bot detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Inject mock function on every navigation to prevent buggy portal scripts from blocking form submissions
    await this.page.evaluateOnNewDocument(() => {
      window.validateFreeSpace = function() { return true; };
    });
    
    // Add extra headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Cache-Control': 'max-age=0'
    });

    console.log('✅ Page initialized with stealth headers');

    // Page-level error handling
    this.page.on('error', err => {
      console.error('🌐 Page crashed (error event):', err.message);
    });

    this.page.on('pageerror', err => {
      console.error('🌐 Browser Console Error:', err.message);
    });

    this.page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('Dispatch') || url.includes('Allotment')) {
        console.log(`⚠️ Request failed: ${url} (${request.failure().errorText})`);
      }
    });
  }

  /**
   * Reliably fill the username/password fields and VERIFY the DOM actually
   * holds what we typed before moving on.
   *
   * Root cause of the "Please Enter User Name" alert on retries:
   * on a fresh cold-launch the browser has no cached JS, so the extra time
   * spent parsing/executing the portal's bundle means the framework has
   * already finished hydrating its controlled inputs by the time our
   * `.click()+.type()` runs. On a retry mid-session, the same assets come
   * from cache and DOMContentLoaded fires almost instantly - our code reaches
   * the input a beat before the framework attaches its change listeners, so
   * keystrokes land in a plain DOM node the framework's internal state never
   * sees. On submit, the framework re-renders from that (still-empty) state
   * and the field looks blank to its own validator, firing the alert - even
   * though Puppeteer "saw" the type() succeed.
   *
   * Fix: wait for the field to be visible, type it, then dispatch the
   * events a real user's blur triggers, then read `.value` back and retype
   * (with a short backoff for hydration) if it doesn't match.
   */
  async fillFieldReliably(selectors, value, label, maxAttempts = 3) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let element = null;
      let matchedSelector = null;

      for (const selector of selectorList) {
        try {
          await this.page.waitForSelector(selector, { visible: true, timeout: 5000 });
          element = await this.page.$(selector);
          if (element) {
            matchedSelector = selector;
            break;
          }
        } catch (e) {
          continue; // this selector never showed up in time, try the next
        }
      }

      if (!element) {
        if (attempt < maxAttempts) {
          console.log(`   ⏳ ${label} field not visible yet (attempt ${attempt}/${maxAttempts}), waiting...`);
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return false;
      }

      // Clear any stale/partial value (select-all + type overwrites instead of appending)
      await element.click({ clickCount: 3 });
      await this.page.keyboard.press('Backspace').catch(() => {});
      await element.type(value, { delay: 100 });

      // Force the framework's controlled-input state to sync, the same way
      // a real user's blur/tab would, instead of relying on keystroke timing.
      await this.page.evaluate((el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      }, element).catch(() => {});

      // Verify the DOM actually holds what we typed before trusting it.
      const actualValue = await this.page.evaluate((el) => el.value, element).catch(() => null);

      if (actualValue === value) {
        console.log(`✅ ${label} entered and verified with selector: ${matchedSelector}`);
        return true;
      }

      console.log(`   ⚠️ ${label} verification mismatch (got "${actualValue}"), retrying (attempt ${attempt}/${maxAttempts})...`);
      await new Promise(r => setTimeout(r, 500));
    }

    return false;
  }

  /**
   * Login to SCM Portal
   * Handles CAPTCHA with automatic retry and manual fallback
   */
  async login(username, password, maxRetries = 5, onProgress = null) {
    console.log('🔐 Attempting login...');
    if (typeof onProgress === 'function') onProgress('Navigating to SCM portal...');

    try {
      // Navigate to login page with automatic HTTP/HTTPS fallback for portal timeouts
      try {
        await this.page.goto(this.baseURL, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (err) {
        const altURL = this.baseURL.startsWith('https://')
          ? this.baseURL.replace('https://', 'http://')
          : this.baseURL.replace('http://', 'https://');
        console.warn(`⚠️ Primary navigation warning for ${this.baseURL}: ${err.message}. Retrying with ${altURL}...`);
        await this.page.goto(altURL, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
      }

      console.log('✅ Page loaded successfully');
      await this.screenshot('01_initial_page.png');

      // Wait a bit for any dynamic content
      await new Promise(r => setTimeout(r, 1000));

      // Login form should be directly visible on Login.jsp
      console.log('✅ On login page, form should be visible');
      await this.screenshot('02_login_page.png');

      // Enter credentials with multiple selector attempts (waits for visibility
      // and verifies the DOM value before proceeding — see fillFieldReliably)
      console.log('Entering username...');
      if (typeof onProgress === 'function') onProgress('Entering credentials...');
      const usernameSelectors = [
        '#uid',
        'input[name="user_id"]',
        'input[name="userName"]',
        'input[name="username"]',
        'input[id="userName"]',
        'input[id="username"]',
        'input[type="text"]'
      ];

      const usernameEntered = await this.fillFieldReliably(usernameSelectors, username, 'Username');

      if (!usernameEntered) {
        await this.screenshot('03_username_error.png');
        throw new Error('Could not find or verify username input field');
      }

      // Enter password
      console.log('Entering password...');
      const passwordSelectors = [
        '#pwd',
        'input[name="password"]',
        'input[id="password"]',
        'input[type="password"]'
      ];

      const passwordEntered = await this.fillFieldReliably(passwordSelectors, password, 'Password');

      if (!passwordEntered) {
        await this.screenshot('04_password_error.png');
        throw new Error('Could not find or verify password input field');
      }

      await this.screenshot('05_credentials_entered.png');

      // Check for CAPTCHA
      const hasCaptcha = await this.checkForCaptcha();

      if (hasCaptcha) {
        console.log('⚠️ CAPTCHA detected');
        await this.screenshot('06_captcha_detected.png');

        // Try automatic CAPTCHA solving first
        let captchaSolved = await this.attemptAutoCaptcha(this.isHeadless ? 12 : 20, onProgress);

        if (!captchaSolved && maxRetries > 0) {
          if (this.isHeadless) {
            console.log('🤖 Headless mode: Cannot do manual CAPTCHA. Throwing error immediately...');
            throw new Error('CAPTCHA could not be solved automatically in headless mode.');
          }
          console.log('🔄 Automatic CAPTCHA failed, enabling manual mode...');
          console.log('');
          console.log('================================================');
          console.log('🖐️  MANUAL CAPTCHA REQUIRED');
          console.log('================================================');
          console.log('Please look at the Chrome browser window that opened.');
          console.log('1. Type the CAPTCHA code in the input field');
          console.log('2. Click the Submit/Login button');
          console.log('');
          console.log('⏳ Waiting up to 120 seconds for you to complete this...');
          console.log('================================================');
          console.log('');

          // Wait for user to solve CAPTCHA and submit
          // Instead of auto-clicking submit, wait for navigation
          try {
            await this.page.waitForNavigation({
              waitUntil: 'domcontentloaded',
              timeout: 120000  // 2 minutes
            });
            console.log('✅ Navigation detected - CAPTCHA solved and submitted!');
            await this.screenshot('07_after_manual_captcha.png');
          } catch (error) {
            console.log('⏱️ Timeout waiting for manual CAPTCHA submission');
            await this.screenshot('07_captcha_timeout.png');
            throw new Error('Manual CAPTCHA not completed within time limit');
          }
        }
      } else {
        // No CAPTCHA - submit login form automatically
        console.log('Submitting login form...');

        // Try finding submit button using various Puppeteer-compatible methods
        let submitted = false;

        const submitSelectors = [
          '#lobtn',
          'input[name="lobtn"]',
          'input[value="Login"]',
          'input[type="submit"]'
        ];

        for (const selector of submitSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              await element.click();
              submitted = true;
              console.log(`✅ Form submitted with selector: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!submitted) {
          // Try XPath for buttons with specific text
          try {
            const [button] = await this.page.$$("::-p-xpath(//button[contains(., 'Submit') or contains(., 'Login')])");
            if (button) {
              await button.click();
              submitted = true;
              console.log('✅ Form submitted via XPath button');
            }
          } catch (e) { }
        }

        if (!submitted) {
          // Try pressing Enter as fallback
          await this.page.keyboard.press('Enter');
          console.log('✅ Form submitted via Enter key');
        }

        // Wait for navigation
        await this.page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 60000
        }).catch(() => {
          console.log('Navigation timeout, checking if logged in...');
        });
      }

      await this.screenshot('08_after_submit.png');

      // Verify login success
      const isLoggedIn = await this.verifyLogin();

      if (isLoggedIn) {
        console.log('✅ Login successful!');
        await this.screenshot('09_login_success.png');
        return true;
      } else {
        await this.screenshot('09_login_failed.png');
        if (maxRetries > 0) {
          console.log(`❌ Login failed, retrying... (${maxRetries} attempts remaining)`);
          await new Promise(r => setTimeout(r, 2000));
          return await this.login(username, password, maxRetries - 1);
        } else {
          throw new Error('Login failed after maximum retries');
        }
      }

    } catch (error) {
      console.error('❌ Login error:', error.message);
      throw error;
    }
  }

  /**
   * Check if CAPTCHA is present on the page
   */
  async checkForCaptcha() {
    try {
      const captchaSelectors = [
        'img[src*="captcha"]',
        'img[alt*="captcha"]',
        '#captcha',
        '.captcha',
        'input[name="captcha"]'
      ];

      for (const selector of captchaSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }



  /**
   * Verify if login was successful
   */
  async verifyLogin() {
    try {
      console.log('🧐 Verifying login status...');
      await new Promise(r => setTimeout(r, 1000)); // Wait for page to settle

      // Check for common logged-in indicators using Puppeteer-compatible way
      const indicators = [
        'Logout',
        'Reports',
        'Welcome',
        'Login Successful',
        'Administrator'
      ];

      // Check page text
      const pageText = await this.page.evaluate(() => document.body.innerText);
      for (const indicator of indicators) {
        if (pageText.includes(indicator)) {
          console.log(`✅ Found login indicator in text: ${indicator}`);
          return true;
        }
      }

      // Check for links with specific text using XPath
      const logoutLink = await this.page.$$("::-p-xpath(//a[contains(text(), 'Logout') or contains(text(), 'Reports')])");
      if (logoutLink.length > 0) {
        console.log('✅ Found Logout/Reports link via XPath');
        return true;
      }

      // Check if still on login page (indicates failure)
      const url = this.page.url().toLowerCase();
      // If we are on Login.jsp but see 'Login Successful', it's a success
      if (url.includes('login') && !pageText.includes('Login Successful')) {
        console.log('❌ Still on login page and no success message found');
        return false;
      }

      // If we're on a different page and no error message, assume success
      const hasError = await this.page.$('.error, .alert-danger, .error-message');
      if (!hasError) {
        console.log('✅ Not on login page and no errors found, assuming success');
        return true;
      }

      return false;
    } catch (error) {
      if (error.message.includes('Execution context was destroyed')) {
        console.log(`✅ Navigation detected during verification (Login Successful)`);
        return true;
      }
      console.log(`⚠️ Error during login verification: ${error.message}`);
      return false;
    }
  }

  /**
   * Navigate to Dispatch Abstract report page
   */
  async navigateToDispatchAbstract(retries = 3) {
    console.log(`[V${this.VERSION}] 📊 Navigating to Dispatch Abstract (Attempt ${4 - retries}/3)...`);

    try {
      // Check for blank page or session error first
      const sessionStatus = await this.checkSessionError();
      if (sessionStatus) {
        console.log(`🔄 Session status [${sessionStatus}] detected before navigation. Recovering...`);
        await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
      }

      // 1. Check for splash screen/welcome link
      const splashClicked = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const welcomeLink = links.find(a => a.innerText.includes('Welcome to ePos') || a.innerText.includes('ePos Management'));
        if (welcomeLink) {
          welcomeLink.click();
          return true;
        }
        return false;
      });

      if (splashClicked) {
        console.log('👆 Splash screen detected and clicked');
        await new Promise(r => setTimeout(r, 1000));
      }

      // Verify page is not blank after splash click
      if (await this.isPageBlank()) {
        console.log('⚠️ Page is blank after splash click, reloading...');
        await this.page.reload({ waitUntil: 'domcontentloaded' });
      }

      // 2. Find and click "Reports" menu
      const reportsClicked = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const reportLink = links.find(a =>
          a.innerText.trim().toLowerCase() === 'reports' ||
          a.innerText.trim() === 'रिपोर्ट' ||
          a.href.includes('Report')
        );
        if (reportLink) {
          reportLink.click();
          return true;
        }
        return false;
      });

      if (!reportsClicked) {
        const [reportsMenu] = await this.page.$$("::-p-xpath(//a[contains(normalize-space(), 'Reports') or contains(normalize-space(), 'रिपोर्ट')])");
        if (reportsMenu) {
          await reportsMenu.click();
        } else {
          // If we can't find reports, maybe we are on the wrong page or session died
          console.log('⚠️ Reports menu not found. Checking session...');
          if (await this.isPageBlank() || await this.checkSessionError()) {
            throw new Error('SESSION_LOST_OR_BLANK_PAGE');
          }
          throw new Error('Reports menu link not found on page');
        }
      }

      console.log('✅ Clicked Reports menu');
      await new Promise(r => setTimeout(r, 1000));

      // 3. Find and click "Dispatch Abstract"
      const dispatchClicked = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const dispatchLink = links.find(a =>
          a.innerText.includes('Dispatch Abstract') ||
          a.innerText.includes('डिस्पैच') ||
          a.href.includes('DispatchAbstract')
        );
        if (dispatchLink) {
          dispatchLink.click();
          return true;
        }
        return false;
      });

      if (!dispatchClicked) {
        const [dispatchLink] = await this.page.$$("::-p-xpath(//a[contains(normalize-space(), 'Dispatch Abstract') or contains(normalize-space(), 'डिस्पैच')])");
        if (dispatchLink) {
          await dispatchLink.click();
        } else {
          throw new Error('Dispatch Abstract link not found in Reports menu');
        }
      }

      console.log('✅ Clicked Dispatch Abstract');
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(e => {
          console.warn(`⚠️ Navigation timeout or issue: ${e.message}. Attempting to proceed...`);
      });

      // Final verification that we are on the right page
      const isFormPage = await this.page.evaluate(() => !!document.querySelector('select, #btnGetDetails, #btnSubmit'));
      if (!isFormPage) {
        if (await this.isPageBlank()) throw new Error('NAVIGATED_TO_BLANK_PAGE');
        console.warn('⚠️ Navigation finished but form elements not found.');
      }

      console.log(`[V${this.VERSION}] ✅ Navigation Successful`);
      return true;

    } catch (error) {
      console.error(`❌ Navigation Attempt ${4 - retries} failed:`, error.message);
      await this.screenshot(`v104_nav_error_attempt_${4 - retries}.png`);

      if (retries > 1) {
        console.log('🔄 Retrying navigation with full reload...');
        try {
          await this.page.goto(this.baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
        } catch (e) {
          await this.page.reload({ waitUntil: 'networkidle2' });
        }
        return await this.navigateToDispatchAbstract(retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if the current page is blank or failed to render
   */
  async isPageBlank() {
    return await this.page.evaluate(() => {
      const bodyText = document.body?.innerText?.trim() || "";
      const bodyHtml = document.body?.innerHTML?.trim() || "";
      // Page is blank if body is tiny or contains only whitespace/header
      return bodyText.length < 50 && bodyHtml.length < 500 && !document.querySelector('a, button, select, input');
    });
  }

  /**
   * Wait for page to finish loading (wait for "Loading...." text to disappear)
   */
  async waitForDataLoad(timeout = 30000) {
    console.log('⏳ Waiting for data to load...');
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isLoading = await this.page.evaluate(() => {
        return document.body.innerText.includes('Loading');
      });

      if (!isLoading) {
        console.log('✅ Data loaded successfully');
        return true;
      }

      await new Promise(r => setTimeout(r, 500)); // Reduced from 1000ms to 500ms
    }

    console.log('⚠️ Loading timeout - proceeding anyway');
    return false;
  }

  /**
   * Select month, year, and RO type on the Dispatch Abstract form, then click Get Details
   */
  async selectFormAndGetDetails(month, year, roType) {
    this.currentMonth = month;
    this.currentYear = year;
    this.currentRoType = roType;
    console.log(`\n📋 Setting form: Month=${month}, Year=${year}, RO Type=${roType}`);

    if (await this.checkSessionError()) {
      console.log('🔄 Re-logging in due to session error...');
      await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
      return await this.selectFormAndGetDetails(month, year, roType);
    }

    try {
      // Wait for the form to be ready
      await new Promise(r => setTimeout(r, 800));

      // Discover available selects to find the right selectors
      const selectInfo = await this.page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select'));
        return selects.map(s => ({
          name: s.name,
          id: s.id,
          tagIndex: Array.from(document.querySelectorAll('select')).indexOf(s),
          options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
        }));
      });

      console.log(`🔍 Found ${selectInfo.length} select elements`);
      selectInfo.forEach((s, i) => {
        console.log(`  [${i}] name="${s.name}" id="${s.id}" options: ${s.options.slice(0, 3).map(o => `${o.value}="${o.text}"`).join(', ')}...`);
      });

      if (selectInfo.length < 3) {
        console.log(`❌ Expected at least 3 select elements (month, year, RO type), found ${selectInfo.length}`);
        const bodyContent = await this.page.evaluate(() => document.body.innerHTML);
        fs.writeFileSync(path.join(this.logsDir, 'form_error_page.html'), bodyContent);
        console.log('📝 Saved form error page HTML for debugging');
        await this.screenshot('form_error_selects.png');
        return false;
      }

      // Select Month (dynamically identify)
      const monthSelect = selectInfo.find(s => s.id === 'month' || s.name === 'month' || s.options.some(o => o.text.toLowerCase().includes('january'))) || selectInfo[1] || selectInfo[0];
      const monthSelector = monthSelect.id ? `#${monthSelect.id}` : (monthSelect.name ? `select[name="${monthSelect.name}"]` : 'select#month');

      // Month matching logic (handles "February", "02", 2, "February (फरवरी)")
      const monthNames = ['', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthNamesHindi = ['', 'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
      let targetMonthValue = month.toString();

      // If month is a name like "February", convert to index
      if (isNaN(parseInt(month))) {
        const foundIdx = monthNames.indexOf(month.toString().toLowerCase());
        if (foundIdx !== -1) targetMonthValue = foundIdx.toString();
      }

      const monthOption = monthSelect.options.find(o => {
        const text = (o.text || '').toLowerCase();
        const target = (monthNames[parseInt(targetMonthValue)] || '').toLowerCase();
        const targetHindi = (monthNamesHindi[parseInt(targetMonthValue)] || '').toLowerCase();
        
        return text === target || 
               (target && text.includes(target)) || 
               (targetHindi && text.includes(targetHindi)) ||
               o.value === targetMonthValue ||
               o.value === targetMonthValue.padStart(2, '0');
      });

      if (monthOption) {
        await this.page.select(monthSelector, monthOption.value);
        console.log(`✅ Month selected: "${monthOption.text}" (value: ${monthOption.value})`);
      } else {
        console.log(`⚠️ Month option not found for ${month}, trying direct value ${targetMonthValue}`);
        await this.page.select(monthSelector, targetMonthValue);
      }
      await new Promise(r => setTimeout(r, 500));

      // Select Year (dynamically identify)
      const yearSelect = selectInfo.find(s => s.id === 'year' || s.name === 'year' || s.options.some(o => o.value === '2025' || o.value === '2026')) || selectInfo[2] || selectInfo[1];
      const yearSelector = yearSelect.id ? `#${yearSelect.id}` : (yearSelect.name ? `select[name="${yearSelect.name}"]` : 'select#year');

      const yearOption = yearSelect.options.find(o =>
        o.value === year.toString() || (o.text && o.text.trim() === year.toString())
      );

      if (yearOption) {
        await this.page.select(yearSelector, yearOption.value);
        console.log(`✅ Year selected: "${yearOption.text}" (value: ${yearOption.value})`);
      } else {
        const lastOption = yearSelect.options[yearSelect.options.length - 1];
        if (lastOption) {
          await this.page.select(yearSelector, lastOption.value);
          console.log(`⚠️ Using latest available year: "${lastOption.text}"`);
        }
      }
      await new Promise(r => setTimeout(r, 500));

      // Select RO Type (dynamically identify)
      const roSelect = selectInfo.find(s => s.id === 'ro_type' || s.name === 'ro_type' || s.options.some(o => o.value === 'REG' || o.value === 'EXT')) || selectInfo[4] || selectInfo[2];
      const roSelector = roSelect.id ? `#${roSelect.id}` : (roSelect.name ? `select[name="${roSelect.name}"]` : 'select#ro_type');

      const roTypeHindi = {
        'Regular': 'नियमित',
        'Extra': 'अतिरिक्त',
        'Portability': 'पोर्टेबिलिटी'
      };

      const roOption = roSelect.options.find(o => {
        const text = (o.text || '').toLowerCase();
        const target = roType.toLowerCase();
        const targetHindi = (roTypeHindi[roType] || '').toLowerCase();
        
        return text.includes(target) || (targetHindi && text.includes(targetHindi)) ||
               (o.value && o.value.toLowerCase().includes(target));
      });

      if (roOption) {
        await this.page.select(roSelector, roOption.value);
        console.log(`✅ RO Type selected: "${roOption.text}" (value: ${roOption.value})`);
      } else {
        console.log(`⚠️ RO Type "${roType}" not found. Available: ${roSelect.options.map(o => o.text).join(', ')}`);
      }
      await new Promise(r => setTimeout(r, 500));

      // Wait for any "Loading..." to disappear before clicking
      try {
        await this.page.waitForFunction(() => !document.body.innerText.toUpperCase().includes('LOADING'), { timeout: 15000 });
      } catch (e) {
        console.log("⚠️ Loading indicator still present, proceeding anyway...");
      }
      await new Promise(r => setTimeout(r, 500));

      // Take screenshot of form before submitting
      await this.screenshot('form_before_submit.png');

      // Click "Get Details" button
      const clicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
        for (const btn of buttons) {
          const text = (btn.value || btn.innerText || '').toLowerCase();
          if (text.includes('get') || text.includes('detail') || text.includes('submit') || text.includes('show')) {
            btn.click();
            return btn.value || btn.innerText;
          }
        }
        return null;
      });

      if (clicked) {
        console.log(`✅ Clicked button: "${clicked}"`);
      } else {
        console.log('⚠️ Get Details button not found!');
        return false;
      }

      // Wait for data to load (AJAX)
      await new Promise(r => setTimeout(r, 500)); // Reduced from 1000ms

      // Selectively wait for the RO type header to be present in the document
      try {
        await this.page.waitForFunction((type) => {
          const bodyText = document.body.innerText.toUpperCase();
          return bodyText.includes(`${type.toUpperCase()} ALLOTMENT`) ||
            bodyText.includes(`ISSUE POINT`) ||
            bodyText.includes(`NO RECORD FOUND`) ||
            bodyText.includes(`NO DATA`);
        }, { timeout: 15000 }, roType);
        console.log(`✅ Results header validated for: ${roType}`);
      } catch (e) {
        console.log(`⚠️ Could not validate header for ${roType}, proceeding anyway...`);
      }

      await this.waitForDataLoad(15000);

      await this.screenshot('form_after_submit.png');
      return true;

    } catch (error) {
      console.error(`❌ Form selection error: ${error.message}`);
      await this.screenshot('form_error.png');
      return false;
    }
  }

  /**
   * Extract summary data from the main table (all issue points at once)
   */
  async extractSummaryData() {
    console.log('\n📊 Extracting summary table data...');

    try {
      const summaryData = await this.page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));

        // Find the main data table (look for table with "ISSUE POINT" header)
        let dataTable = null;
        for (const table of tables) {
          const headerText = table.innerText || '';
          if (headerText.includes('ISSUE POINT') || headerText.includes('Issue Point')) {
            dataTable = table;
            break;
          }
        }

        // Find the actual grid table
        dataTable = tables.find(t => {
          const text = t.innerText.toUpperCase();
          return text.includes('ISSUE POINT') && text.includes('ALLOTMENT') && t.querySelectorAll('tr').length > 5;
        });

        if (!dataTable) {
          // Fallback: find the largest table with at least 5 rows
          let maxRows = 0;
          for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length > maxRows && rows.length >= 5) {
              maxRows = rows.length;
              dataTable = table;
            }
          }
        }

        if (!dataTable) return { rows: [], headers: [] };

        const allRows = Array.from(dataTable.querySelectorAll('tr'));
        const tableHtml = dataTable.outerHTML;

        // Find the actual header row
        let headerIndex = -1;
        for (let i = 0; i < Math.min(allRows.length, 10); i++) {
          const text = allRows[i].innerText.toLowerCase();
          if (text.includes('sl. no.') || text.includes('issue point')) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) return { rows: [], headers: [] };

        const headers = Array.from(allRows[headerIndex].querySelectorAll('th, td')).map(h => h.innerText.trim());

        // Extract data rows
        const data = [];
        let grandTotals = {
          alloted: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
          dispatched: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
          received: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 }
        };

        for (let i = headerIndex + 1; i < allRows.length; i++) {
          const row = allRows[i];
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length < 25) continue; // Relaxed from 30 to 25 to handle UI column variations

          const getVal = (colIdx) => {
            const val = cells[colIdx]?.innerText?.replace(/,/g, '').trim() || '0';
            return (parseFloat(val) || 0) / 100; // Convert to Quintals
          };

          const firstCellText = (cells[0]?.innerText || '').trim().toLowerCase();
          const secondCellText = (cells[1]?.innerText || '').trim().toLowerCase();
          const isTotalRow = firstCellText.includes('total') || secondCellText.includes('total') ||
            firstCellText.includes('yog') || secondCellText.includes('yog') ||
            firstCellText.includes('grand') || secondCellText.includes('grand');

          if (isTotalRow) {
            // Extract grand totals for verification (Indices based on screenshot)
            // Alloted Wheat is idx 2, etc.
            grandTotals = {
              alloted: {
                wheat: getVal(2), rice: getVal(3), sugar: getVal(4), salt: getVal(5), fSalt: getVal(6), maize: getVal(7), fortifiedRice: getVal(8)
              },
              dispatched: {
                wheat: getVal(16), rice: getVal(17), sugar: getVal(18), salt: getVal(19), fSalt: getVal(20), maize: getVal(21), fortifiedRice: getVal(22)
              },
              received: {
                wheat: getVal(23), rice: getVal(24), sugar: getVal(25), salt: getVal(26), fSalt: getVal(27), maize: getVal(28), fortifiedRice: getVal(29)
              }
            };
            console.log('✅ Found Summary Total Row:', JSON.stringify(grandTotals.alloted));
            continue;
          }

          if (isNaN(parseInt(firstCellText))) continue;

          const getSum = (indices) => indices.reduce((sum, idx) => sum + getVal(idx), 0);

          const nfsaIndices = [2, 3, 4, 5, 6, 7, 8]; // Include All (Wheat, Rice, Sugar, Salt, FSalt, Maize, Fortified Rice)
          const allIndices = [2, 3, 4, 5, 6, 7, 8]; // Same as NFSA per user request

          const rowData = {
            serialNo: firstCellText,
            issuePoint: cells[1]?.innerText?.trim(),
            // NFSA Totals (Used for main report columns)
            nfsaAllocation: getSum(nfsaIndices),
            nfsaDispatch: getSum(nfsaIndices.map(i => i + 14)), // 16, 17, 21, 22
            nfsaReceived: getSum(nfsaIndices.map(i => i + 21)), // 23, 24, 28, 29
            // Grand Totals (Includes Sugar/Salt)
            totalAllocation: getSum(allIndices),
            totalDispatch: getSum(allIndices.map(i => i + 14)),
            totalReceived: getSum(allIndices.map(i => i + 21)),
            // Compatibility for old code
            values: [
              getSum(nfsaIndices), // First value as NFSA
              getSum(nfsaIndices.map(i => i + 14)),
              getSum(nfsaIndices.map(i => i + 21))
            ]
          };

          if (rowData.issuePoint && rowData.issuePoint !== '') {
            data.push(rowData);
          }
        }

        return { rows: data, headers: headers, grandTotals: grandTotals, tableHtml: tableHtml };
      });

      // Save debug HTML
      if (summaryData.tableHtml) {
        fs.writeFileSync(path.join(this.logsDir, 'summary_table_debug.html'), summaryData.tableHtml);
        console.log('📝 Saved summary table HTML for debugging');
      }

      console.log(`📊 Summary headers: ${summaryData.headers.slice(0, 5).join(' | ')}...`);
      console.log(`📊 Found ${summaryData.rows.length} issue points in summary table`);

      summaryData.rows.forEach(row => {
        console.log(`  📍 ${row.serialNo}. ${row.issuePoint}: ${row.values.slice(0, 5).join(', ')}...`);
      });

      return summaryData;

    } catch (error) {
      console.error(`❌ Summary extraction error: ${error.message}`);
      return { rows: [], headers: [] };
    }
  }

  /**
   * Click on an issue point link to get detailed per-shop data
   */
  async extractIssuePointDetail(issuePointName, issuePointCode, rowIndex = 0) {
    console.log(`\n🔍 Getting detail data for: ${issuePointName}`);

    try {
      let detailTableFound = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (await this.checkSessionError()) {
          console.log('🔄 Session lost during detail click. Recovering...');
          await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
          // NOTE: previously this did a raw `page.goto(RO_ABSTRACT)`, which lands on a
          // different/stale page (3 selects instead of 4, no #btnGetDetails, wrong year
          // range) because the report page depends on state set by the Reports > Dispatch
          // Abstract menu click, not just the URL. Go through the real navigation path.
          await this.navigateToDispatchAbstract();
          // Re-select form
          if (this.currentMonth && this.currentYear && this.currentRoType) {
            await this.selectFormAndGetDetails(this.currentMonth, this.currentYear, this.currentRoType);
          }
        }

          // Clear any existing detail table to prevent extracting stale data on timeout
          await this.page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            for (const t of tables) {
              const txt = t.innerText.toUpperCase();
              if ((txt.includes('SHOP CODE') || txt.includes('FPS CODE') || txt.includes('SHOP NAME') || 
                   txt.includes('SHOPS') || txt.includes('ISSUED')) && t.querySelectorAll('tr').length > 5) {
                  t.remove();
              }
            }
          });

        // Find and click the issue point link
        const clicked = await this.page.evaluate((name, code, idx) => {
          const tables = Array.from(document.querySelectorAll('table'));
          const dataTable = tables.find(t => t.innerText.includes('ISSUE POINT') || t.innerText.includes('Sl. No.'));
          if (!dataTable) return null;

          const links = Array.from(dataTable.querySelectorAll('a, span[onclick], td[onclick]'));
          let link = links.find(l => (l.getAttribute('onclick') || '').includes(`'${code}'`));

          if (!link) {
            link = links.find(l => {
              const text = (l.innerText || '').trim().toLowerCase();
              return text.includes(code.toLowerCase()) || text.includes(name.toLowerCase());
            });
          }

          if (!link) {
            link = links.find(l => (l.getAttribute('onclick') || '').includes(`ro_detailsShop('${idx}')`) ||
              (l.getAttribute('onclick') || '').includes(`ro_detailsShop(${idx})`));
          }

          if (link) {
            link.click();
            return { clicked: true, text: link.innerText.trim() };
          }
          return null;
        }, issuePointName, issuePointCode, rowIndex);

        if (await this.checkSessionError()) {
        console.log(`      ⚠️ Session issue detected during detail extraction for ${issuePointName}`);
        throw new Error('SESSION_LOST_DURING_DETAIL');
      }

      await new Promise(r => setTimeout(r, 500));

        if (!clicked) {
          console.log(`⚠️ Link selection failed for ${issuePointName} at index ${rowIndex}`);
          await this.page.reload({ waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        console.log(`✅ Clicked link for ${issuePointName} using index ${rowIndex}`);

        // Wait for detail table
        try {
          await this.page.waitForFunction(() => {
            const body = document.body.innerText.toUpperCase();
            // Look for headers unique to the data table
            return body.includes('SHOP NAME') || body.includes('FPS NAME') ||
              body.includes('SHOP_NAME') || body.includes('ISSUED QTY') ||
              (body.includes('DETAILS') && body.includes('SL. NO.') && !body.includes('Another Person'));
          }, { timeout: 20000 });
          detailTableFound = true;
          break;
        } catch (e) {
          console.log(`⚠️ Detail table timeout for ${issuePointName}, attempt ${attempt}`);
          await new Promise(r => setTimeout(r, 1000));
          const sessionErr = await this.checkSessionError();
          if (sessionErr) {
            console.log(`🔄 Session error (${sessionErr}) confirmed during detail wait. Recovering...`);
            // Clear cookies and relogin
            const client = await this.page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');

            await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
            // Go through the menu-click navigation, not a raw goto — see note above.
            await this.navigateToDispatchAbstract();
            if (this.currentMonth && this.currentYear && this.currentRoType) {
              await this.selectFormAndGetDetails(this.currentMonth, this.currentYear, this.currentRoType);
            }
          }
        }
      }

      if (!detailTableFound) {
        const bodyContent = await this.page.evaluate(() => document.body.innerHTML);
        fs.writeFileSync(path.join(this.logsDir, `detail_page_failed_${issuePointName.replace(/[^a-z0-9]/gi, '_')}.html`), bodyContent);
        console.log(`❌ Failed to find detail table for ${issuePointName}. Saved page HTML.`);
        return [];
      }

      const allShops = [];
      const shopCodesInSector = new Set();
      let pageNum = 1;
      let hasNextPage = true;

      while (hasNextPage && pageNum <= 10) {
        await this.page.waitForSelector('.table, table', { timeout: 10000 }).catch(() => { });

        const shopsData = await this.page.evaluate(() => {
          let root = document;
          const iframe = document.querySelector('iframe, frame');
          try {
            if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
              root = iframe.contentWindow.document;
            }
          } catch (e) { }

          const tables = Array.from(root.querySelectorAll('table'));
          // Detail table contains "SHOP CODE" or "FPS CODE" or "SHOPS" and has many rows
          // IMPORTANT: Check for id "shop_report" or headers unique to shop data
          let dataTable = tables.find(t => {
            if (t.id === 'headt') return false;
            if (t.id === 'shop_report') return true;
            const txt = t.innerText.toUpperCase();
            return (txt.includes('SHOP CODE') || txt.includes('FPS CODE') || txt.includes('SHOP NAME') || txt.includes('SHOPS') || txt.includes('ISSUED')) &&
              t.querySelectorAll('tr').length > 5;
          });

          if (!dataTable) {
            // Fallback: any table (not headt) where any row has 20+ columns
            dataTable = tables.find(t => {
              if (t.id === 'headt') return false;
              const rows = Array.from(t.querySelectorAll('tr'));
              return rows.some(r => r.cells.length >= 20);
            });
          }

          if (!dataTable) {
            const bodyContent = root.body?.innerText || "";
            if (bodyContent.includes("Login Successful") || bodyContent.includes("Welcome to ePos")) {
               return { error: 'SPLASH_SCREEN_REDIRECT', tableHtml: root.body?.innerHTML };
            }
            return { shops: [], tableHtml: root.body?.innerHTML || "No Body Content" };
          }

          const rows = Array.from(dataTable.querySelectorAll('tr'));
          const shops = rows.filter(r => r.cells.length > 5 && !isNaN(parseInt(r.cells[1]?.innerText)))
            .map(r => {
              const shopCode = r.cells[1]?.innerText.trim();
              const getVal = (idx) => {
                const val = r.cells[idx]?.innerText?.replace(/,/g, '').trim() || '0';
                return (parseFloat(val) || 0) / 100; // Convert Kg to Quintals
              };

              // Find the top header row with "Alloted", "Dispatched", etc. to dynamically calculate column spans
              const topHeaderRow = dataTable.rows[1]; // Usually the second row has the grouped colspans
              let headersRaw = [];
              if (topHeaderRow) {
                for (let i = 0; i < topHeaderRow.cells.length; i++) {
                  let cellText = topHeaderRow.cells[i].innerText.trim().toUpperCase();
                  let colspan = parseInt(topHeaderRow.cells[i].getAttribute('colspan') || 1);
                  headersRaw.push({ name: cellText, colspan: colspan });
                }
              }

              // Set default indices in case dynamic logic fails (based on 7 commodities)
              let allocStart = 2, allocEnd = 8;
              let dispStart = 16, dispEnd = 22;
              let recStart = 23, recEnd = 29;

              try {
                // Find exactly mapping dynamic indices based on colspans
                let currentIdx = 0;
                // Skip the first 2 static columns (Sl No., ISSUE POINT / Shops)
                // Wait, some topHeaderRow structures are odd. The most robust way is to just look for the colspans
                let allotedSpan = headersRaw.find(h => h.name.includes("ALLOTED"))?.colspan || 7;
                let roSpan = headersRaw.find(h => h.name.includes("RELEASED ORDER") || h.name === "RO")?.colspan || 7;
                let dispSpan = headersRaw.find(h => h.name.includes("DISPATCHED"))?.colspan || 7;
                let recvSpan = headersRaw.find(h => h.name.includes("RECEIVED"))?.colspan || 7;

                allocStart = 2; // Always starts after 2 fixed columns
                allocEnd = allocStart + allotedSpan - 1;

                dispStart = allocEnd + 1 + roSpan; // Skip Allocation + RO
                dispEnd = dispStart + dispSpan - 1;

                recStart = dispEnd + 1; // Immediately follows Dispatch
                recEnd = recStart + recvSpan - 1;
              } catch (e) {
                console.warn("Failed to dynamically parse colspans, using defaults:", e.message);
              }

              const sumRange = (start, end) => {
                let sum = 0;
                for (let i = start; i <= end; i++) {
                  if (r.cells[i]) sum += getVal(i);
                }
                return sum;
              };

              return {
                shopCode: shopCode,
                shopName: shopCode, // No name column in this layout, use code
                nfsaAllocation: sumRange(allocStart, allocEnd),
                nfsaDispatch: sumRange(dispStart, dispEnd),
                nfsaReceipt: sumRange(recStart, recEnd),
                allocation: sumRange(allocStart, allocEnd),
                dispatch: sumRange(dispStart, dispEnd),
                posReceipt: sumRange(recStart, recEnd),
                commodities: {
                  wheat: getVal(allocStart), rice: getVal(allocStart + 1), sugar: getVal(allocStart + 2),
                  salt: getVal(allocStart + 3), fSalt: getVal(allocStart + 4), maize: getVal(allocStart + 5),
                  fortifiedRice: getVal(allocStart + 6)
                },
                dispatchCommodities: {
                  wheat: getVal(dispStart), rice: getVal(dispStart + 1), sugar: getVal(dispStart + 2),
                  salt: getVal(dispStart + 3), fSalt: getVal(dispStart + 4), maize: getVal(dispStart + 5),
                  fortifiedRice: getVal(dispStart + 6)
                },
                receivedCommodities: {
                  wheat: getVal(recStart), rice: getVal(recStart + 1), sugar: getVal(recStart + 2),
                  salt: getVal(recStart + 3), fSalt: getVal(recStart + 4), maize: getVal(recStart + 5),
                  fortifiedRice: getVal(recStart + 6)
                }
              };
            });

          if (shops.length > 0) {
            const s = shops[0];
            console.log(`      👀 Debug First Shop [${s.shopCode}]: Alloc=${s.allocation.toFixed(2)}, Disp=${s.dispatch.toFixed(2)} [W=${s.dispatchCommodities.wheat}, R=${s.dispatchCommodities.rice}]`);
          }

          return { shops, tableHtml: dataTable.outerHTML };
        });

        if (shopsData.tableHtml) {
          fs.writeFileSync(path.join(this.logsDir, `detail_table_${issuePointName.replace(/[^a-z0-9]/gi, '_')}.html`), shopsData.tableHtml);
          console.log(`      📝 Saved detail table HTML for ${issuePointName}`);
        }

        if (shopsData.error === 'SPLASH_SCREEN_REDIRECT') {
           throw new Error('PORTAL_REDIRECTED_TO_SPLASH');
        }

        const shops = shopsData.shops || [];

        shops.forEach(shop => {
          if (!shopCodesInSector.has(shop.shopCode)) {
            allShops.push(shop);
            shopCodesInSector.add(shop.shopCode);
          }
        });

        console.log(`      📄 Page ${pageNum}: Found ${shops.length} shops`);

        const nextClicked = await this.page.evaluate((currentPage) => {
          const links = Array.from(document.querySelectorAll('a'));
          const targetPage = (currentPage + 1).toString();
          const nextLink = links.find(l => l.innerText.trim() === targetPage) ||
            links.find(l => l.innerText.trim() === 'Next' || l.innerText.trim() === '>');
          if (nextLink) {
            nextLink.click();
            return true;
          }
          return false;
        }, pageNum);

        if (nextClicked) {
          pageNum++;
          await new Promise(r => setTimeout(r, 1000));
          await this.waitForDataLoad(10000);
        } else {
          hasNextPage = false;
        }
      }

      console.log(`      ✅ Total unique shops for ${issuePointName}: ${allShops.length}`);
      return allShops;

    } catch (error) {
      console.error(`❌ Detail extraction failed for ${issuePointName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Worker-friendly method to extract data for a single RO type
   * Handles full lifecycle: init -> login -> navigate -> extract -> close
   */
  /**
   * Core extraction method for a single RO type.
   * Assumes browser is initialized and user is logged in.
   */
  async extractRoTypeData(month, year, roType, onProgress = null) {
    const startTime = Date.now();
    let extractionData = [];
    let summaryTotals = null;

    try {
      console.log(`🚀 [${roType}] Starting extraction...`);
      if (onProgress) onProgress(0, 100, `[${roType}] Navigating to portal...`);

      // Ensure we are on the Dispatch Abstract page
      await this.navigateToDispatchAbstract();
      if (onProgress) onProgress(5, 100, `[${roType}] Form loaded, selecting parameters...`);

      let formSuccess = false;
      let summary = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (await this.selectFormAndGetDetails(month, year, roType)) {
          if (onProgress) onProgress(10, 100, `[${roType}] Extracting summary table...`);
          summary = await this.extractSummaryData();
          if (summary && summary.rows.length > 0) {
            formSuccess = true;
            break;
          } else {
            console.log(`⚠️ [${roType}] Form loaded but no data rows found. Retrying...`);
          }
        }
        console.log(`🔄 [${roType}] Retrying form selection (Attempt ${attempt}/3)...`);
        if (onProgress) onProgress(5, 100, `[${roType}] Retrying form selection (${attempt}/3)...`);
        await this.page.reload({ waitUntil: 'networkidle2' });
        await this.navigateToDispatchAbstract();
      }

      if (!formSuccess) {
        if (!summary || summary.rows.length === 0) {
          console.log(`[${roType}] No data found for this selection after 3 attempts.`);
          return { rawData: [], summaryTotals: null, status: 'empty' };
        }
        throw new Error(`Failed to select form for ${roType} after 3 attempts`);
      }

      summaryTotals = summary.grandTotals;

      let consecutiveZeroSectors = 0;

      // Extract details
      for (let i = 0; i < summary.rows.length; i++) {
        const row = summary.rows[i];
        const name = row.issuePoint;
        const code = row.issuePoint?.match(/\((\d+)\)/)?.[1] || '';

        if (onProgress) onProgress(i + 1, summary.rows.length, `Processing [${roType}]: ${name}...`);

        // Smart skipping optimization:
        // SCM Abstract summary pages are notoriously bugged and sometimes report 0 allocation/dispatch despite having data.
        // For 'Regular' (97% of transactions), we never skip extraction to ensure we don't miss hidden data.
        // For 'Portability' and 'Extra', we safely skip zero-value sectors to drastically reduce extraction time (from ~9m to ~3m).
        const expectedDispatch = row.totalDispatch || 0;
        const expectedAllocation = row.totalAllocation || 0;
        
        if (roType !== 'Regular' && expectedDispatch < 0.01 && expectedAllocation < 0.01) {
            console.log(`[${roType}] ⏭️ Skipping empty sector ${name} (Allocation: ${expectedAllocation}, Dispatch: ${expectedDispatch})`);
            continue; // Skip the detail page completely
        }

        let retryAttempt = 0;
        let details = [];
        let fetchedValidDispatch = false;

        while (retryAttempt < 3 && !fetchedValidDispatch) {
          // Efficient Navigation: Only re-click if absolutely necessary or retrying
          if (i > 0 || retryAttempt > 0) {
            const hasTable = await this.page.evaluate(() => !!document.querySelector('#depotreport, table.main-table, #btnGetDetails'));
            if (!hasTable) {
              console.log(`[${roType}] 🔄 Summary table lost or retrying, navigating back...`);
              await this.page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => { });
            }
          }

          details = await this.extractIssuePointDetail(name, code, i) || [];

          // Validate SCM Backend Timeout (Abstract promised Dispatch/Allocation, Details gave 0)
          const extractedAllocation = details.reduce((sum, s) => sum + (s.allocation || 0), 0);
          const extractedDispatch = details.reduce((sum, s) => sum + (s.dispatch || 0), 0);

          if ((expectedDispatch >= 50 && extractedDispatch < 1) || (expectedAllocation >= 50 && extractedAllocation < 1)) {
            if (consecutiveZeroSectors >= 2) {
              console.log(`⚠️ Bypassing Strict Integrity Check for ${name} because the portal is consistently returning 0s today.`);
              fetchedValidDispatch = true; // accept the zeroes
            } else {
              console.error(`❌ SCM Backend Timeout Detected for ${name}! Expected ~${expectedDispatch.toFixed(2)} Qt Disp / ~${expectedAllocation.toFixed(2)} Qt Alloc, got 0 Qt. HTML returned empty columns.`);
              retryAttempt++;

              if (retryAttempt < 3) {
                console.log(`🔄 Attempt ${retryAttempt}/3: Clearing cookies and forcefully re-loading Abstract...`);
                // Clear Session to break SCM backend caching
                const client = await this.page.target().createCDPSession();
                await client.send('Network.clearBrowserCookies');

                await this.login(process.env.SCM_USERNAME, process.env.SCM_PASSWORD);
                // Go through the menu-click navigation, not a raw goto — a direct
                // goto(RO_ABSTRACT) lands on a stale/different page (3 selects instead
                // of 4, no #btnGetDetails, wrong year range) which is why every one of
                // these retries was failing with "Get Details button not found!" and
                // "Link selection failed" regardless of how many times it looped.
                await this.navigateToDispatchAbstract();
                if (this.currentMonth && this.currentYear && this.currentRoType) {
                  await this.selectFormAndGetDetails(this.currentMonth, this.currentYear, this.currentRoType);
                }
              } else {
                console.error(`❌ Exhausted retries for ${name}.`);
                consecutiveZeroSectors++;
                fetchedValidDispatch = true; // accept the zeroes and move on!
              }
            }
          } else {
            consecutiveZeroSectors = 0; // reset on success!
            fetchedValidDispatch = true; // Success!
          }
        }

        if (details) {
          details.forEach(shop => {
            // Recalculate allocation and dispatch ensuring they never drop undefined
            extractionData.push({ ...shop, roType, issuePoint: name, issuePointCode: code, month, year });
          });
        }
      }

      return {
        rawData: extractionData,
        summaryTotals: summaryTotals,
        status: 'success',
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error(`[${roType}] Extraction failed:`, error.message);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility (wraps extractRoTypeData)
   */
  async extractSingleRoType(month, year, roType, credentials, onProgress = null, headless = true) {
    try {
      await this.init(headless);
      await this.login(credentials.username, credentials.password);
      const result = await this.extractRoTypeData(month, year, roType, onProgress);
      return result;
    } catch (error) {
      throw error;
    } finally {
      await this.close();
    }
  }

  // extractAllData removed - replaced by parallel worker logic in server.js


  /**
   * Close browser
   */
  /**
   * Check if we hit the "Another Person Trying to Login" error
   */
  async checkSessionError() {
    return await this.page.evaluate(() => {
      const body = document.body;
      if (!body) return 'BLANK_PAGE';
      const text = (body.innerText || '') + (document.documentElement?.outerHTML || '');
      const lower = text.toLowerCase();
      
      if (lower.includes('another person trying to login')) return 'SESSION_CONFLICT';
      if (lower.includes('session expired')) return 'SESSION_EXPIRED';
      if (lower.includes('please login again')) return 'SESSION_EXPIRED';
      if (lower.includes('invalid url')) return 'INVALID_URL';
      if (lower.includes('please go back to home')) return 'INVALID_URL';
      
      // Check for blank page or loading hang
      const visibleLinks = Array.from(document.querySelectorAll('a')).filter(a => a.offsetParent !== null);
      if (visibleLinks.length === 0 && body.innerText.trim().length < 100) return 'BLANK_PAGE';
      
      return null;
    });
  }

  async close() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
    if (this.browser) {
      await this.browser.close();
      console.log('🔚 Browser closed');
    }
  }

  /**
   * Take screenshot for debugging
   */
  async screenshot(filename) {
    try {
      // Ensure logs directory exists
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      const screenshotPath = path.join(this.logsDir, filename);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath} `);
    } catch (error) {
      console.log(`⚠️ Failed to save screenshot: ${error.message} `);
    }
  }
}

module.exports = SCMScraper;


