
import React from 'react';
import { Mail, Clock, MoreVertical, ChevronDown, Sparkles, Send } from 'lucide-react';
import MergeTag from './MergeTag';

const SequenceEditor: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-white/50">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Trigger */}
        <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                <Clock size={14} className="text-gray-400" />
                <span>Start <span className="font-bold">immediately</span> after enrollment</span>
                <ChevronDown size={14} className="text-gray-400" />
            </div>
        </div>

        {/* Step 1 Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 flex items-center justify-center rounded-md border border-gray-200 bg-white">
                        <Mail size={12} className="text-gray-500" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 1</span>
                    <span className="text-xs font-medium text-gray-500">Automated email</span>
                </div>
                <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={14} className="text-gray-400" />
                </button>
            </div>
            
            <div className="p-6 space-y-4">
                <div className="flex items-start gap-4 text-sm">
                    <span className="text-gray-400 w-12 pt-1">Subject</span>
                    <div className="font-medium flex items-center flex-wrap gap-1">
                        Hey <MergeTag label="name > full" type="person" /> — I think we're the right fit for you!
                    </div>
                </div>
                
                <div className="h-px bg-gray-100 w-full"></div>

                <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>
                        Hi <MergeTag label="name > first" type="person" />,
                    </p>
                    <div className="flex items-center gap-2 py-1 px-3 bg-blue-50/50 border border-blue-100/50 rounded-lg text-blue-700 font-medium w-fit">
                        <Sparkles size={14} />
                        Intro to <span className="underline decoration-blue-200 underline-offset-4">break the ice</span>
                    </div>
                    <p>
                        I've seen that your company <MergeTag label="company > name" type="company" /> is specialized in the field <MergeTag label="company > industry" type="company" />.
                        From my experience companies in that segment profit a lot from our software so I'd love to show you some helpful advances features I think perfectly matches to your work.
                    </p>
                    <p>
                        I have a good availability this week — do you have time somewhen this week to go through this?
                    </p>
                    <p>
                        I'd love to help you making more out of your business and looking forward to hear from you, <MergeTag label="name > first" type="person" />.
                    </p>
                    <div className="space-y-0.5">
                        <p>Best regrads,</p>
                        <p className="font-medium">Account Owner</p>
                    </div>

                    <div className="pt-4 flex items-center gap-2 text-[11px] text-gray-400">
                        <Send size={12} />
                        <span>Sender signature will appear here</span>
                        <HelpCircleSmall />
                    </div>
                    
                    <p className="text-[11px] text-gray-300">
                        Note: If you don't want to hear from me again, just <span className="underline cursor-pointer">click here.</span>
                    </p>
                </div>
            </div>
        </div>

        {/* Wait Transition */}
        <div className="relative py-8 flex flex-col items-center group">
            <div className="absolute inset-y-0 w-px bg-gray-100"></div>
            <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span>Wait <span className="font-bold">2 business days</span></span>
                    <ChevronDown size={14} className="text-gray-400" />
                </div>
                <div className="w-4 h-4 rounded-full border border-gray-200 bg-white flex items-center justify-center">
                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                </div>
            </div>
        </div>

        {/* Step 2 Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 flex items-center justify-center rounded-md border border-gray-200 bg-white">
                        <Mail size={12} className="text-gray-500" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 2</span>
                    <span className="text-xs font-medium text-gray-500">Automated email</span>
                </div>
                <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={14} className="text-gray-400" />
                </button>
            </div>
            
            <div className="p-6 space-y-4">
                <div className="flex items-start gap-4 text-sm">
                    <span className="text-gray-400 w-12 pt-1">Subject</span>
                    <div className="font-medium flex items-center flex-wrap gap-1">
                        Hey <MergeTag label="name > full" type="person" />, Just catching up
                    </div>
                </div>
                
                <div className="h-px bg-gray-100 w-full"></div>

                <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>
                        Hi <MergeTag label="name > first" type="person" />,
                    </p>
                    <p>
                        I've recently messaged you about your company <MergeTag label="company > name" type="company" /> and was wondering if you're interested in learning more about our work:
                    </p>
                </div>
            </div>
        </div>
        
      </div>
    </div>
  );
};

const HelpCircleSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

export default SequenceEditor;
