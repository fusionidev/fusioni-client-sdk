import React from 'react';
import { Map } from './Map';
import { Message } from './Message';
import { FusioniMemoryMessage } from '../types';

// Example usage of the Map component with the message structure you provided
export const MapExample: React.FC = () => {
  // Example message with map data in extra_data
  const exampleMessage: FusioniMemoryMessage = {
    id: "7e2R_JkBJVtzXPS_QKe4",
    agency_id: "687e56a6b8cbca38a7b5f216",
    conversation_id: "68f4978d2e7212afea9c37f0",
    mem_type: "short",
    role: "assistant",
    shouldAnimate: false,
    keywords: [],
    thoughts: "The user asked to show Los Angeles on the map. The context contains the latitude and longitude of Los Angeles, which are 34.0549076 and -118.242643, respectively. I used this information to create a map tool with the specified coordinates and a zoom level of 10.",
    created: new Date("2025-10-19T16:03:21.619911"),
    content: "I can show you Los Angeles on the map.",
    loading: false,
    extra_data: {
      map: {
        lat: "34.0549076",
        lng: "-118.242643",
        zoom: "10"
      }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2>Map Component Example</h2>
      
      {/* Direct Map component usage */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Direct Map Component (Static):</h3>
        <Map
          lat="34.0549076"
          lng="-118.242643"
          zoom="10"
          staticMap={true}
          width={600}
          height={400}
          apiBaseUrl="https://your-api-domain.com"
          apiKey="your-api-key-here"
          agencyId="687e56a6b8cbca38a7b5f216"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Direct Map Component (Interactive):</h3>
        <Map
          lat="34.0549076"
          lng="-118.242643"
          zoom="10"
          staticMap={false}
          width={600}
          height={400}
          agencyId="687e56a6b8cbca38a7b5f216"
        />
      </div>

      {/* Map component within a Message */}
      <div>
        <h3>Map within Message Component:</h3>
        <Message message={exampleMessage} agencyId={exampleMessage.agency_id} />
      </div>
    </div>
  );
};

export default MapExample;
