
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './WelcomeScreen.css';
import { useTools, Template } from '../../../lib/state';

const welcomeContent: Record<Template, { title: string; description: string; prompts: string[] }> = {
  'customer-support': {
    title: 'Customer Support',
    description: 'Handle customer inquiries and see how function calls can automate tasks.',
    prompts: [
      "I'd like to return an item.",
      "What's the status of my order?",
      'Can I speak to a representative?',
    ],
  },
  'personal-assistant': {
    title: 'Personal Assistant',
    description: 'Manage your schedule, send emails, and set reminders.',
    prompts: [
      'Create a calendar event for a meeting tomorrow at 10am.',
      'Send an email to jane@example.com.',
      'Set a reminder to buy milk.',
    ],
  },
  'navigation-system': {
    title: 'Navigation System',
    description: 'Find routes, nearby places, and get traffic information.',
    prompts: [
      'Find a route to the nearest coffee shop.',
      'Are there any parks nearby?',
      "What's the traffic like on the way to the airport?",
    ],
  },
  'orbit-agent': {
    title: 'Orbit Agent',
    description: 'Control your robotic system and VPS (168.231.78.113) with voice commands.',
    prompts: [
      'Show me system logs.',
      'How is the server performing?',
      'Run "df -h" on my VPS.',
    ],
  },
  'beatrice': {
    title: 'Beatrice',
    description: 'Your personal assistant for VPS management (168.231.78.113) with voice commands.',
    prompts: [
      'Good morning, Beatrice. What are my tasks today?',
      'Check the server health, please.',
      'Run "docker ps" for me.',
    ],
  },
};

const WelcomeScreen: React.FC = () => {
  const { template } = useTools();
  const { title, description, prompts } = welcomeContent[template];
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h2 className="welcome-title">{title}</h2>
        <p className="welcome-description">{description}</p>
        <div className="example-prompts">
          {prompts.map((prompt, index) => (
            <div key={index} className="prompt">{prompt}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
