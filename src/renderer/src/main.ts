/* eslint-disable vue/no-reserved-component-names */
import 'primeicons/primeicons.css'
import './assets/main.css'

import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

import Button from 'primevue/button'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import FileUpload from 'primevue/fileupload'
import Slider from 'primevue/slider'
import Toast from 'primevue/toast'
import Tooltip from 'primevue/tooltip'

import App from './App.vue'
import store from './store'

document.documentElement.classList.add('dark')

const app = createApp(App)

app.use(store)
app.use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.dark' } } })
app.use(ToastService)
app.use(ConfirmationService)

app.component('Button', Button)
app.component('Select', Select)
app.component('ToggleSwitch', ToggleSwitch)
app.component('InputText', InputText)
app.component('InputNumber', InputNumber)
app.component('FileUpload', FileUpload)
app.component('Slider', Slider)
app.component('Toast', Toast)

app.directive('tooltip', Tooltip)

app.mount('#app')
