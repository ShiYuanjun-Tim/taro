---
title: 异步编程
---

Taro 支持使用 `async functions` 来让开发者获得不错的异步编程体验，开启 `async functions` 支持需要安装包 `@tarojsrn/async-await`

```bash
$ yarn add @tarojsrn/async-await
# 或者使用 npm
$ npm install --save @tarojsrn/async-await
```

随后在项目入口文件 `app.js` 中直接 `import` ，就可以开始使用 `async functions` 功能了

```javascript
// src/app.js
import '@tarojsrn/async-await'
```

> 值得注意的事，使用 `@tarojsrn/async-await` 一定要记得按照[开发前注意](./before-dev-remind.md)中提示的内容进行操作，否则会出现报错
