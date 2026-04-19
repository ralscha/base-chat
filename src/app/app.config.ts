import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { MockDataService } from './core/services/mock-data.service';
import { ThemeService } from './core/services/theme.service';

function initializeApp(mockData: MockDataService, theme: ThemeService) {
  return () => {
    mockData.seed();
    // ThemeService constructor applies the saved theme — instantiating it here ensures
    // the theme is applied before any component renders.
    void theme;
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [MockDataService, ThemeService],
      multi: true,
    },
  ],
};
