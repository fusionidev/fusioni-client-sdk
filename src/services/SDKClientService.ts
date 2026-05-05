import {getApiClient} from './ApiClient';
import {FusioniSDKConfig} from '../types';

export interface SDKClientResponse {
  id?: string;
  website_url?: string;
  agency_id?: string;
  theme?: 'light' | 'dark' | 'auto' | null;
  show_theme_toggle?: boolean;
  show_fullscreen_toggle?: boolean;
  show_language_switcher?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | null;
  primary_color?: string | null;
  show_conversation_list?: boolean | null;
  enable_audio_recording?: boolean | null;
  enable_file_upload?: boolean | null;
  max_file_size?: number | null;
  allowed_file_types?: string[] | null;
  language?: 'en' | 'el';
  button_variant?: 'minimal' | 'glass' | 'solid';
}

export class SDKClientService {
  private getApiClient() {
    return getApiClient();
  }

  /**
   * Get SDK Client configuration by agency ID
   * @param agencyId
   */
  async getClientConfig(agencyId: string): Promise<SDKClientResponse | null> {
    const apiClient = this.getApiClient();
    const response = await (apiClient as any).client.get('/sdk-client/agency/website', {
      params: {
        agency_id: agencyId
      }
    });
    return response.data || null;
  }

  /**
   * Merge server configuration with user configuration
   * Server config takes precedence for non-null values
   */
  mergeConfig(userConfig: FusioniSDKConfig, serverConfig: SDKClientResponse | null): FusioniSDKConfig {
    if (!serverConfig) {
      return userConfig;
    }

    return {
      ...userConfig,
      // Only override if server value is not null
      theme: serverConfig.theme !== null && serverConfig.theme !== undefined 
        ? serverConfig.theme 
        : userConfig.theme,
      showThemeToggle: serverConfig.show_theme_toggle !== undefined
        ? serverConfig.show_theme_toggle
        : userConfig.showThemeToggle,
      showFullscreenToggle: serverConfig.show_fullscreen_toggle !== undefined
        ? serverConfig.show_fullscreen_toggle
        : userConfig.showFullscreenToggle,
      showLanguageSwitcher: serverConfig.show_language_switcher !== undefined
        ? serverConfig.show_language_switcher
        : userConfig.showLanguageSwitcher,
      position: serverConfig.position !== null && serverConfig.position !== undefined 
        ? serverConfig.position 
        : userConfig.position,
      primaryColor: serverConfig.primary_color !== null && serverConfig.primary_color !== undefined 
        ? serverConfig.primary_color 
        : userConfig.primaryColor,
      showConversationList: typeof serverConfig.show_conversation_list === 'boolean'
        ? serverConfig.show_conversation_list 
        : userConfig.showConversationList,
      enableAudioRecording: typeof serverConfig.enable_audio_recording === 'boolean'
        ? serverConfig.enable_audio_recording 
        : userConfig.enableAudioRecording,
      enableFileUpload: typeof serverConfig.enable_file_upload === 'boolean'
        ? serverConfig.enable_file_upload 
        : userConfig.enableFileUpload,
      maxFileSize: serverConfig.max_file_size !== null && serverConfig.max_file_size !== undefined 
        ? serverConfig.max_file_size 
        : userConfig.maxFileSize,
      allowedFileTypes: serverConfig.allowed_file_types !== null && serverConfig.allowed_file_types !== undefined 
        ? serverConfig.allowed_file_types 
        : userConfig.allowedFileTypes,
      language: serverConfig.language !== undefined 
        ? serverConfig.language 
        : userConfig.language,
      buttonVariant: serverConfig.button_variant !== undefined 
        ? serverConfig.button_variant 
        : userConfig.buttonVariant,
    };
  }
}

// Singleton instance
let sdkClientServiceInstance: SDKClientService | null = null;

export const getSDKClientService = (): SDKClientService => {
  if (!sdkClientServiceInstance) {
    sdkClientServiceInstance = new SDKClientService();
  }
  return sdkClientServiceInstance;
};

