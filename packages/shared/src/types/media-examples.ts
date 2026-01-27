// Пример с фото
export const photoExample = {
  version: 1,
  states: {
    welcome: {
      message: "Добро пожаловать!",
      media: {
        type: "photo",
        url: "https://example.com/welcome.jpg",
        caption: "Наш офис"
      },
      buttons: [
        { type: "navigation", text: "Далее", nextState: "menu" }
      ]
    }
  },
  initialState: "welcome"
};

// Пример с каруселью
export const mediaGroupExample = {
  version: 1,
  states: {
    gallery: {
      message: "Наши товары",
      mediaGroup: [
        { type: "photo", url: "https://example.com/1.jpg", caption: "Товар 1" },
        { type: "photo", url: "https://example.com/2.jpg", caption: "Товар 2" }
      ],
      buttons: [
        { type: "url", text: "Купить", url: "https://shop.example.com" }
      ]
    }
  },
  initialState: "gallery"
};
