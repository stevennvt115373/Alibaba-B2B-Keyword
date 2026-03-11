/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Part, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Form Elements
const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById(
  'search-input'
) as HTMLInputElement;
const countrySelect = document.getElementById(
  'country-select'
) as HTMLSelectElement;
const searchButton = document.getElementById(
  'search-button'
) as HTMLButtonElement;
const resultsContainer = document.getElementById(
  'results-container'
) as HTMLDivElement;

// Image Upload Elements
const imageUploadContainer = document.getElementById(
  'image-upload-container'
) as HTMLDivElement;
const imageDropZone = document.getElementById(
  'image-drop-zone'
) as HTMLLabelElement;
const imageInput = document.getElementById('image-input') as HTMLInputElement;
const imagePreviewContainer = document.getElementById(
  'image-preview-container'
) as HTMLDivElement;
const imagePreview = document.getElementById(
  'image-preview'
) as HTMLImageElement;
const removeImageBtn = document.getElementById(
  'remove-image-btn'
) as HTMLButtonElement;

// State
let currentQuery = '';
let currentCountry = '';
let currentImage: { mimeType: string; data: string } | null = null;
type Keyword = { keyword: string; country: string };

// Initial state setup
updateSearchButtonState();

// Event Listeners
searchForm.addEventListener('submit', handleFormSubmit);
searchInput.addEventListener('input', updateSearchButtonState);
imageInput.addEventListener('change', handleFileInputChange);
removeImageBtn.addEventListener('click', removeImage);

// Drag and Drop Listeners
imageDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageUploadContainer.classList.add('dragover');
});
imageDropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  imageUploadContainer.classList.remove('dragover');
});
imageDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageUploadContainer.classList.remove('dragover');
  if (e.dataTransfer?.files?.length) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  }
});

function updateSearchButtonState() {
  const hasText = searchInput.value.trim().length > 0;
  const hasImage = !!currentImage;
  searchButton.disabled = !hasText && !hasImage;
}

function handleFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFileSelect(target.files[0]);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
}

async function handleFileSelect(file: File) {
  try {
    const base64Data = await fileToBase64(file);
    currentImage = {
      mimeType: file.type,
      data: base64Data,
    };
    imagePreview.src = `data:${file.type};base64,${base64Data}`;
    imageDropZone.classList.add('hidden');
    imagePreviewContainer.classList.remove('hidden');
    updateSearchButtonState();
  } catch (error) {
    console.error('Error processing file:', error);
    displayError('There was an error processing the image file.');
  }
}

function removeImage() {
  currentImage = null;
  imageInput.value = ''; // Reset file input
  imagePreview.src = '#';
  imageDropZone.classList.remove('hidden');
  imagePreviewContainer.classList.add('hidden');
  updateSearchButtonState();
}

async function handleFormSubmit(e: Event) {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query && !currentImage) return;

  currentQuery = query;
  currentCountry = countrySelect.value;
  setLoading(true);
  resultsContainer.innerHTML = '';

  try {
    const parts: Part[] = [];
    let prompt = `You are an expert B2B marketing strategist and an e-commerce optimization specialist for Alibaba.com. Your goal is to help users build a powerful presence on Alibaba by providing in-depth keyword analysis for market research.`;

    if (currentImage) {
      parts.push({
        inlineData: currentImage,
      });
      prompt += ` Analyze the product in the image.`;
    }

    if (query) {
      prompt += ` The user also provided this description: "${query}".`;
    }

    if (currentCountry) {
      prompt += ` The analysis should be focused on the "${currentCountry}" market.`;
    }

    prompt += ` Provide a detailed breakdown of keywords categorized into three levels:
        1.  **Short-tail Keywords:** Broad, high-volume search terms (1-2 words).
        2.  **Medium-tail Keywords:** More specific phrases (2-4 words).
        3.  **Long-tail Keywords:** Highly specific, lower-volume phrases (4+ words).

        The total combined character count of all generated keyword strings should be approximately 350 characters to meet platform requirements.

        For EACH keyword in all categories, identify the top country where this keyword is most frequently searched. Also provide a list of 6 optimized product titles, each with a maximum length of 125 characters. Return the data in a structured JSON format.`;
    parts.push({ text: prompt });

    const keywordObjectSchema = {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING },
        country: {
          type: Type.STRING,
          description: 'The country name where the keyword is most searched.',
        },
      },
      required: ['keyword', 'country'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shortTailKeywords: {
              type: Type.ARRAY,
              items: keywordObjectSchema,
            },
            mediumTailKeywords: {
              type: Type.ARRAY,
              items: keywordObjectSchema,
            },
            longTailKeywords: {
              type: Type.ARRAY,
              items: keywordObjectSchema,
            },
            titles: {
              type: Type.ARRAY,
              description:
                'List of 6 optimized product titles for high click-through rates, each with a maximum length of 125 characters.',
              items: { type: Type.STRING },
            },
          },
          required: [
            'shortTailKeywords',
            'mediumTailKeywords',
            'longTailKeywords',
            'titles',
          ],
        },
      },
    });

    const result = JSON.parse(response.text);
    displayResults(result);
  } catch (error) {
    console.error(error);
    displayError(
      'Sorry, an error occurred while fetching data. Please try again.'
    );
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading: boolean) {
  if (isLoading) {
    searchButton.disabled = true;
    searchInput.disabled = true;
    countrySelect.disabled = true;
    imageInput.disabled = true;
    imageUploadContainer.style.opacity = '0.6';
    imageUploadContainer.style.pointerEvents = 'none';
    resultsContainer.innerHTML = '<div class="loader"></div>';
  } else {
    updateSearchButtonState();
    searchInput.disabled = false;
    countrySelect.disabled = false;
    imageInput.disabled = false;
    imageUploadContainer.style.opacity = '1';
    imageUploadContainer.style.pointerEvents = 'auto';
  }
}

function displayResults(data: {
  shortTailKeywords: Keyword[];
  mediumTailKeywords: Keyword[];
  longTailKeywords: Keyword[];
  titles: string[];
}) {
  const allKeywords = [
    ...data.shortTailKeywords,
    ...data.mediumTailKeywords,
    ...data.longTailKeywords,
  ];

  resultsContainer.innerHTML = `
    ${renderKeywordsSection('Targeted Keywords', allKeywords)}
    <section class="results-section" id="titles-section">
       <div class="section-header">
        <h2>Optimized Product Titles</h2>
        <div class="section-header-actions">
           <button class="header-btn" id="refresh-titles-btn" aria-label="Refresh titles">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <ul class="titles-list">
        ${renderTitles(data.titles)}
      </ul>
    </section>
  `;

  addEventListeners();
}

function renderKeywordsSection(title: string, keywords: Keyword[]) {
  return `
    <section class="results-section" id="keywords-section">
      <div class="section-header">
        <h2>${title}</h2>
        <div class="section-header-actions">
          <button class="header-btn" id="copy-all-keywords-btn" aria-label="Copy all ${title}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy All</span>
          </button>
          <button class="header-btn" id="refresh-keywords-btn" aria-label="Refresh ${title}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <div class="keywords-grid" id="keywords-grid">
        ${renderKeywords(keywords)}
      </div>
    </section>
  `;
}

function renderKeywords(keywords: Keyword[]): string {
  if (!keywords || keywords.length === 0) {
    return `<div class="error-message-inline">No keywords found.</div>`;
  }
  return keywords
    .map(
      (kw) => `
      <div class="keyword-tag" tabindex="0">
        <span class="keyword-flag">${countryNameToEmoji(kw.country)}</span>
        <span class="keyword-text">${kw.keyword}</span>
        <button class="copy-btn" aria-label="Copy keyword ${kw.keyword}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>`
    )
    .join('');
}

function renderTitles(titles: string[]): string {
  if (!titles || titles.length === 0) {
    return `<div class="error-message-inline">No titles found.</div>`;
  }
  return titles
    .map(
      (title) => `
      <li class="title-item">
        <span>${title}</span>
        <button class="copy-btn" aria-label="Copy title ${title}">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </li>`
    )
    .join('');
}

function addEventListeners() {
  addCopyFunctionality();

  // Keywords Section
  document
    .getElementById('copy-all-keywords-btn')
    ?.addEventListener('click', () => handleCopyAllKeywords());
  document
    .getElementById('refresh-keywords-btn')
    ?.addEventListener('click', () => handleRefreshKeywords());

  // Titles Section
  document
    .getElementById('refresh-titles-btn')
    ?.addEventListener('click', handleRefreshTitles);
}

async function handleRefreshKeywords() {
  const keywordsGrid = document.getElementById(
    'keywords-grid'
  ) as HTMLDivElement;
  const refreshBtn = document.getElementById(
    'refresh-keywords-btn'
  ) as HTMLButtonElement;
  if (!keywordsGrid || (!currentQuery && !currentImage) || !refreshBtn) return;

  refreshBtn.disabled = true;
  keywordsGrid.innerHTML = '<div class="loader"></div>';

  try {
    const parts: Part[] = [];
    let prompt = `You are an e-commerce optimization expert specializing in Alibaba.com.`;

    if (currentImage) {
      parts.push({ inlineData: currentImage });
      prompt += ` Analyze the product in the image.`;
    }
    if (currentQuery) {
      prompt += ` The user also provided this description: "${currentQuery}".`;
    }
    if (currentCountry) {
      prompt += ` The analysis should be focused on the "${currentCountry}" market.`;
    }

    prompt += ` Provide a NEW list of short-tail, medium-tail, and long-tail keywords. The total combined character count of all keywords should be approximately 350 characters. For EACH keyword, identify the top country where it's most frequently searched.`;
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shortTailKeywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING },
                  country: { type: Type.STRING },
                },
                required: ['keyword', 'country'],
              },
            },
            mediumTailKeywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING },
                  country: { type: Type.STRING },
                },
                required: ['keyword', 'country'],
              },
            },
            longTailKeywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING },
                  country: { type: Type.STRING },
                },
                required: ['keyword', 'country'],
              },
            },
          },
        },
      },
    });
    const result = JSON.parse(response.text);
    const allKeywords = [
      ...(result.shortTailKeywords || []),
      ...(result.mediumTailKeywords || []),
      ...(result.longTailKeywords || []),
    ];
    keywordsGrid.innerHTML = renderKeywords(allKeywords);
    addCopyFunctionality();
  } catch (error) {
    console.error(error);
    keywordsGrid.innerHTML = `<div class="error-message-inline">Failed to refresh keywords.</div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

async function handleRefreshTitles() {
  const titlesList = document.querySelector(
    '#titles-section .titles-list'
  ) as HTMLUListElement;
  const refreshBtn = document.getElementById(
    'refresh-titles-btn'
  ) as HTMLButtonElement;
  if (!titlesList || (!currentQuery && !currentImage) || !refreshBtn) return;

  refreshBtn.disabled = true;
  titlesList.innerHTML = '<div class="loader"></div>';

  try {
    const parts: Part[] = [];
    let prompt = `You are an e-commerce optimization expert specializing in Alibaba.com.`;

    if (currentImage) {
      parts.push({ inlineData: currentImage });
      prompt += ` Analyze the product in the image.`;
    }
    if (currentQuery) {
      prompt += ` The user also provided this description: "${currentQuery}".`;
    }
    if (currentCountry) {
      prompt += ` The analysis should be focused on the "${currentCountry}" market.`;
    }

    prompt += ` Provide a NEW list of 6 optimized product titles, each with a maximum length of 125 characters.`;
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: {
              type: Type.ARRAY,
              description:
                'A new list of 6 optimized product titles, each with a maximum length of 125 characters.',
              items: { type: Type.STRING },
            },
          },
          required: ['titles'],
        },
      },
    });
    const { titles } = JSON.parse(response.text);
    titlesList.innerHTML = renderTitles(titles);
    addCopyFunctionality();
  } catch (error) {
    console.error(error);
    titlesList.innerHTML = `<div class="error-message-inline">Failed to refresh titles.</div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

function handleCopyAllKeywords() {
  const grid = document.getElementById('keywords-grid');
  const copyBtn = document.getElementById('copy-all-keywords-btn');
  if (!grid || !copyBtn) return;

  const keywords = Array.from(grid.querySelectorAll('.keyword-text'))
    .map((span) => (span as HTMLElement).innerText)
    .join(' '); // Join with a space, not a comma
  if (!keywords) return;

  navigator.clipboard.writeText(keywords).then(() => {
    const originalContent = copyBtn.innerHTML;
    copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Copied!</span>
        `;
    setTimeout(() => {
      copyBtn.innerHTML = originalContent;
    }, 2000);
  });
}

function displayError(message: string) {
  resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

function addCopyFunctionality() {
  resultsContainer.querySelectorAll('.copy-btn').forEach((button) => {
    const newButton = button.cloneNode(true) as HTMLButtonElement;
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', () => {
      const textToCopy = (newButton.previousElementSibling as HTMLElement)
        .innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalIcon = newButton.innerHTML;
        newButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        `;
        setTimeout(() => {
          newButton.innerHTML = originalIcon;
        }, 1500);
      });
    });
  });
}

const COUNTRY_FLAGS: { [key: string]: string } = {
  'United States': '🇺🇸',
  USA: '🇺🇸',
  Germany: '🇩🇪',
  'United Kingdom': '🇬🇧',
  UK: '🇬🇧',
  Brazil: '🇧🇷',
  India: '🇮🇳',
  Vietnam: '🇻🇳',
  Australia: '🇦🇺',
  Canada: '🇨🇦',
  China: '🇨🇳',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  France: '🇫🇷',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  Mexico: '🇲🇽',
  Russia: '🇷🇺',
  Netherlands: '🇳🇱',
  Global: '🌍',
};

function countryNameToEmoji(countryName: string): string {
  if (!countryName) return '🌍'; // Default to global if no country provided
  for (const key in COUNTRY_FLAGS) {
    if (countryName.toLowerCase().includes(key.toLowerCase())) {
      return COUNTRY_FLAGS[key];
    }
  }
  return '🌍'; // Default flag
}
