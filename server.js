// ============================================================
// Trecho para o seu app.js — registra o Handlebars e a rota de preview.
// Requer: npm i express express-handlebars
// ============================================================
const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');
const helpers = require('./src/helpers/handlebars');

const app = express();

app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'panel',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.locals.appName = 'Navalha';

// Preview visual com dados fake (remover quando as rotas reais existirem)
app.use('/preview', require('./src/routes/preview'));
app.get('/', (req, res) => res.redirect('/preview/login'));

app.listen(3000, () => console.log('http://localhost:3000'));
